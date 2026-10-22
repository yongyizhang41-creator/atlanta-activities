'use client';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import type {ReactNode} from 'react';
export function Modal({title,description,children,onClose,wide=false}:{title:string;description?:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
 return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content className={`dialog ${wide?'wide':''}`}><header className="dialog-head"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description className={description?'muted':'sr-only'}>{description||title}</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close dialog"><X size={20}/></Dialog.Close></header>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}){return <div className={`notice ${error?'error':''}`} role={error?'alert':'status'}>{children}</div>;}
export function Field({label,id,children,hint}:{label:string;id:string;children:ReactNode;hint?:string}){return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint&&<small id={id+'-hint'}>{hint}</small>}</div>;}
export function Loading({label='Loading…'}:{label?:string}){return <div className="loading" role="status"><span className="spinner"/>{label}</div>;}
