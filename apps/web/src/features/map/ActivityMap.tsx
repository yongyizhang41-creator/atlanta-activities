'use client';
import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import {Map as MapGL,GeoJSONSource} from 'maplibre-gl';
import {Maximize2,MapPinned} from 'lucide-react';
import type {Config,Filters,MapPoints} from '@/lib/types';
import {Notice} from '@/components/ui';
export default function ActivityMap({points,config,filters,onCenter,onPolygon,onSelect}:{points:MapPoints|null;config:Config;filters:Filters;onCenter:(p:[number,number])=>void;onPolygon:(p:GeoJSON.Polygon)=>void;onSelect:(id:string)=>void}){
 const node=useRef<HTMLDivElement>(null),map=useRef<MapGL|null>(null),latest=useRef({filters,onCenter,onPolygon,onSelect});latest.current={filters,onCenter,onPolygon,onSelect};
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[vertices,setVertices]=useState<[number,number][]>([]);const verticesRef=useRef<[number,number][]>([]);
 useEffect(()=>{if(!node.current)return;let m:MapGL;try{m=new maplibregl.Map({container:node.current,style:config.map_style,center:[-84.391,33.774],zoom:12.4,attributionControl:{compact:true}});map.current=m;}catch{setError('This browser cannot display the map. You can still use the activity list.');return;}
 m.addControl(new maplibregl.NavigationControl(),'top-right');m.on('error',()=>setError('The map could not fully load. Check your connection; the activity list is still available.'));
 m.on('load',()=>{
  m.addSource('events',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterRadius:35,clusterMaxZoom:15});
  m.addLayer({id:'clusters',type:'circle',source:'events',filter:['has','point_count'],paint:{'circle-color':'#2354d8','circle-radius':22,'circle-stroke-width':3,'circle-stroke-color':'#fff'}});
  m.addLayer({id:'cluster-count',type:'symbol',source:'events',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':12},paint:{'text-color':'#fff'}});
  m.addLayer({id:'pins',type:'circle',source:'events',filter:['!', ['has','point_count']],paint:{'circle-color':'#2354d8','circle-radius':8,'circle-stroke-width':3,'circle-stroke-color':'#fff'}});
  m.addSource('selection',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  m.addLayer({id:'selection-fill',type:'fill',source:'selection',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#2354d8','fill-opacity':0.1}});
  m.addLayer({id:'selection-line',type:'line',source:'selection',paint:{'line-color':'#2354d8','line-width':2,'line-dasharray':[3,2]}});
  m.on('click','clusters',async e=>{const f=e.features?.[0];if(!f)return;const source=m.getSource('events') as GeoJSONSource;const z=await source.getClusterExpansionZoom(Number(f.properties?.cluster_id));m.easeTo({center:(f.geometry as GeoJSON.Point).coordinates as [number,number],zoom:z});});
  m.on('click',e=>{const current=latest.current;if(current.filters.geo_mode==='polygon'&&!current.filters.polygon){const next=[...verticesRef.current,[e.lngLat.lng,e.lngLat.lat] as [number,number]];if(next.length<199){verticesRef.current=next;setVertices(next);}return;}
   const pin=m.queryRenderedFeatures(e.point,{layers:['pins']})[0];if(pin){current.onSelect(String(pin.properties?.id));return;}
   if(current.filters.geo_mode==='radius')current.onCenter([e.lngLat.lng,e.lngLat.lat]);
  });
  setReady(true);
 });
 return()=>{m.remove();map.current=null;setReady(false);};},[config.map_style]);
 useEffect(()=>{if(ready&&map.current&&points)(map.current.getSource('events') as GeoJSONSource)?.setData(points);},[points,ready]);
 useEffect(()=>{verticesRef.current=[];setVertices([]);},[filters.geo_mode,filters.polygon]);
 useEffect(()=>{const m=map.current;if(!m||!ready)return;let geometry:GeoJSON.Geometry|null=null;
 if(filters.geo_mode==='polygon'){geometry=filters.polygon|| (vertices.length>1?{type:'LineString',coordinates:vertices}:null);}
 if(filters.geo_mode==='radius'&&filters.center&&filters.radius_m){const [lon,lat]=filters.center;const r=filters.radius_m;geometry={type:'Polygon',coordinates:[Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return [lon+(r*Math.cos(a))/(111320*Math.cos(lat*Math.PI/180)),lat+r*Math.sin(a)/110540];})]};}
 (m.getSource('selection') as GeoJSONSource)?.setData({type:'FeatureCollection',features:geometry?[{type:'Feature',geometry,properties:{}}]:[]});
 },[filters,vertices,ready]);
 function finish(){if(vertices.length<3)return;onPolygon({type:'Polygon',coordinates:[[...vertices,vertices[0]]]});}
 return <section className="map-panel" aria-label="Activity map"><div className="map-top"><span><MapPinned size={15}/>YOUR CITY, MAPPED</span><button className="icon-button" aria-label="Reset map view" onClick={()=>map.current?.fitBounds([[-84.415,33.745],[-84.37,33.803]],{padding:40})}><Maximize2 size={16}/></button></div><div ref={node} className="map-canvas"/>{error&&<div className="map-error"><Notice error>{error}</Notice></div>}{filters.geo_mode==='polygon'&&!filters.polygon&&<div className="draw-toolbar"><span>Click at least 3 points to outline your area.</span><button className="small" disabled={!vertices.length} onClick={()=>{const v=vertices.slice(0,-1);verticesRef.current=v;setVertices(v);}}>Undo point</button><button className="small primary" disabled={vertices.length<3} onClick={finish}>Finish area</button></div>}{filters.geo_mode==='radius'&&!filters.center&&<div className="draw-toolbar">Click on the map to set a center, or use your location.</div>}<div className="map-caption"><span className="pin-dot"/>{points?.total??0} activities in your selection<span>Downtown · Midtown · GT</span></div></section>;
}
