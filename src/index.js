import { MapLayer } from 'react-leaflet'
import L from 'leaflet'
import './L.CanvasOverlay'
import earcut from 'earcut'

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range)
}

function LatLongToPixelXY(latitude, longitude) {
  const pi_180 = Math.PI / 180.0
  const pi_4 = Math.PI * 4
  const sinLatitude = Math.sin(latitude * pi_180)
  const pixelY =
    (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / pi_4) * 256
  const pixelX = (longitude + 180) / 360 * 256

  const pixel = { x: pixelX, y: pixelY }

  return pixel
}

function translateMatrix(matrix, tx, ty) {
  // translation is in last column of matrix
  matrix[12] += matrix[0] * tx + matrix[4] * ty
  matrix[13] += matrix[1] * tx + matrix[5] * ty
  matrix[14] += matrix[2] * tx + matrix[6] * ty
  matrix[15] += matrix[3] * tx + matrix[7] * ty
}

function scaleMatrix(matrix, scaleX, scaleY) {
  // scaling x and y, which is just scaling first two columns of matrix
  matrix[0] *= scaleX
  matrix[1] *= scaleX
  matrix[2] *= scaleX
  matrix[3] *= scaleX

  matrix[4] *= scaleY
  matrix[5] *= scaleY
  matrix[6] *= scaleY
  matrix[7] *= scaleY
}

class LayerGl extends MapLayer {
  setup(canvas) {
    const leafletMap = this.context.map
    const gl = canvas.getContext('webgl', { antialias: true })

    const vshaderText = `uniform mat4 u_matrix;
            attribute vec4 a_vertex;
            attribute float a_pointSize;
            // attribute vec4 a_color;
            varying float v_pointSize;
        
            void main() {
            // Set the size of the point
            gl_PointSize =  a_pointSize;

            // Convert to pixelXY
            float pi_180 = 3.14159 / 180.0;
            float pi_4 = 3.14159 * 4.0;
            float sinLatitude = sin(a_vertex.y * pi_180);
            float pixelY = (0.5 - log((1.0 + sinLatitude) / (1.0 - sinLatitude)) / pi_4) * 256.0;
            float pixelX = (a_vertex.x + 180.0) / 360.0 * 256.0;
        
            // multiply each vertex by a matrix.
            gl_Position =  u_matrix * vec4(pixelX, pixelY, 1, 1);
              
            // pass the color to the fragment shader
            // v_color = a_color;
              v_pointSize = a_pointSize;
            }`

    const fshaderText = `
            precision mediump float;
            varying float v_pointSize;
        
            void main() {
                gl_FragColor = vec4(0,0.4,0.8, 0.3);
        
            }`

    const { vertexShader, fragmentShader } = shaders(gl)
    function shaders(gl) {
      const vertexShader = gl.createShader(gl.VERTEX_SHADER)
      gl.shaderSource(vertexShader, vshaderText)
      gl.compileShader(vertexShader)
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
      gl.shaderSource(fragmentShader, fshaderText)
      gl.compileShader(fragmentShader)

      return { vertexShader, fragmentShader }
    }

    // link shaders to create our program
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.useProgram(program)

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.enable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    // ----------------------------
    // look up the locations for the inputs to our shaders.
    const u_matLoc = gl.getUniformLocation(program, 'u_matrix')
    // var colorLoc = gl.getAttribLocation(program, 'a_color')
    const vertLoc = gl.getAttribLocation(program, 'a_vertex')
    gl.aPointSize = gl.getAttribLocation(program, 'a_pointSize')
    // Set the matrix to some that makes 1 unit 1 pixel.

    gl.viewport(0, 0, canvas.width, canvas.height)

    // -- data

    const polygons = this.props.polygons
    const flattenPolygons = polygons.reduce((a, e) => a.concat(e), [])
    this.preparedData = flattenPolygons.map(preparePolygon)

    function preparePolygon(coords) {
      function makeVerts(el) {
        const verts = []
        el.map(function(d) {
          verts.push(d[0], d[1])
        })
        return verts
      }

      let vertArray
      let index
      let linesArray

      if (coords[0].length != 2) {
        // MultiPolygon
        const datas = earcut.flatten(coords)
        vertArray = new Float32Array(datas.vertices)
        index = earcut(datas.vertices, datas.holes)
        linesArray = new Float32Array(makeVerts(coords[0]))
      } else {
        // Polygon
        const verts = makeVerts(coords)
        vertArray = new Float32Array(verts)
        index = earcut(verts)
        linesArray = vertArray
      }

      return {
        vertArray,
        index,
        linesArray,
      }
    }

    this.index_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index_buffer)

    const fsize = new Float32Array().BYTES_PER_ELEMENT

    const vertBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer)

    gl.vertexAttribPointer(vertLoc, 2, gl.FLOAT, false, fsize * 2, 0)
    gl.enableVertexAttribArray(vertLoc)
    // -- offset for color buffer
    // gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, fsize * 5, fsize * 2)
    // gl.enableVertexAttribArray(colorLoc)

    this.gl = gl
    this.program = program
  }

  createLeafletElement(props) {
    this.props = props

    const leafletMap = this.context.map

    var glLayer = L.canvasLayer()
      .delegate(this)
      .addTo(leafletMap)

    return glLayer
  }

  onDrawLayer(info) {
    if (this.gl == null) {
      this.setup(info.canvas)
    }
    const leafletMap = this.context.map
    const program = this.program
    const canvas = info.canvas
    const gl = this.gl
    const preparedData = this.preparedData

    gl.clear(gl.COLOR_BUFFER_BIT)
    // look up the locations for the inputs to our shaders.
    var u_matLoc = gl.getUniformLocation(program, 'u_matrix')
    // var colorLoc = gl.getAttribLocation(program, 'a_color')
    var vertLoc = gl.getAttribLocation(program, 'a_vertex')
    gl.aPointSize = gl.getAttribLocation(program, 'a_pointSize')
    
    const pixelsToWebGLMatrix = new Float32Array(16)
    // prettier-ignore
    pixelsToWebGLMatrix.set([
      2 / canvas.width,0,0,0,
      0,-2 / canvas.height,0,0,
      0,0,0,0,
      -1,1,0,1
    ])

    // Set viewport
    gl.viewport(0, 0, canvas.width, canvas.height)

    // TODO: unused
    // gl.vertexAttrib1f(gl.aPointSize, pointSize)

    // Set base matrix to translate canvas pixel coordinates -> webgl coordinates
    const mapMatrix = new Float32Array(16)
    mapMatrix.set(pixelsToWebGLMatrix)
    const bounds = leafletMap.getBounds()
    const topLeft = new L.LatLng(bounds.getNorth(), bounds.getWest())
    const offset = LatLongToPixelXY(topLeft.lat, topLeft.lng)
    // Scale to current zoom
    const scale = Math.pow(2, leafletMap.getZoom())
    scaleMatrix(mapMatrix, scale, scale)
    translateMatrix(mapMatrix, -offset.x, -offset.y)
    // Attach matrix value to 'mapMatrix' uniform in shader
    gl.uniformMatrix4fv(u_matLoc, false, mapMatrix)

    preparedData.forEach((obj, i) => {
      // Pass index as point size for now
      gl.vertexAttrib1f(gl.aPointSize, i)

      // Setup data for polygon drawing:
      // 1. vertex
      gl.bufferData(gl.ARRAY_BUFFER, obj.vertArray, gl.STATIC_DRAW)
      // 2. index
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(obj.index),
        gl.STATIC_DRAW,
      )
      // Draw polygons
      gl.drawElements(
        gl.TRIANGLES,
        obj.index.length,
        gl.UNSIGNED_SHORT,
        this.index_buffer,
      )

      // Setup data for polygon borders
      gl.bufferData(gl.ARRAY_BUFFER, obj.linesArray, gl.STATIC_DRAW)
      // Draw
      gl.drawArrays(gl.LINE_LOOP, 0, obj.linesArray.length / 2)
    })
  }
}

export default LayerGl;
