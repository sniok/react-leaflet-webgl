import React, { Component } from 'react'
import { Map, Marker, Popup, TileLayer } from 'react-leaflet'
import './App.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './L.CanvasOverlay'
import earcut from 'earcut'
import LayerGl from  "./lib";
import world from './world.json';


class App extends Component {
  constructor() {
    super()
    this.state = {
      lat: 51.505,
      lng: -0.09,
      zoom: 7,
    }

    this.polygons = world.features
      .map(feature => feature.geometry.coordinates)
      console.log(this.polygons.length);

    
  }

  componentDidMount() {
  }
  render() {
    const position = [
      51.53122329711914, 0.07263199985027313
     ]
    return (
      <Map center={position} zoom={this.state.zoom} ref={c => (this.map = c)}>
        <TileLayer
          attribution="&copy; <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="http://{s}.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png"
        />
        <LayerGl
          polygons={this.polygons}
        />
      </Map>
    )
  }

 
}

export default App
