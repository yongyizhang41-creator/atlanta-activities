'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {MapPin,Compass,Columns3,Settings,LogOut,ArrowUpRight} from 'lucide-react';
import {api,send} from '@/lib/api';
import type {User} from '@/lib/types';
import {Loading,Notice} from './ui';
const Auth=createContext<{user:User;reload:()=>Promise<void>}>({user:{} as User,reload:async()=>{}});
export const useAuth=()=>useContext(Auth);
export function Shell({children}:{children:React.ReactNode}) {
 const [user,setUser]=useState<User|null>(null),[error,setError]=useState('');const path=usePathname(),router=useRouter();
 const reload=async()=>{const data=await api<{user:User;csrf:string}>('/auth/session');setUser(data.user);};
 useEffect(()=>{let active=true;api<{user:User}>('/auth/session').then(d=>{if(active)setUser(d.user);}).catch(e=>{if(e.status===401)router.replace('/login');else if(active)setError(e.message);});return()=>{active=false;};},[router]);
 if(!user)return <main className="boot">{error?<><Notice error>{error}</Notice><button onClick={()=>location.reload()}>Retry</button></>:<Loading label="Opening your city guide…"/>}</main>;
 return <Auth.Provider value={{user,reload}}><header className="topbar"><Link href="/explore" className="brand"><span className="brand-symbol"><MapPin size={22}/></span>ATL<span className="brand-slash">/</span>Out<span className="brand-dot"/></Link><nav aria-label="Main navigation"><Link href="/explore" className={path==='/explore'?'active':''}><Compass size={17}/>Explore</Link><Link href="/my-plans" className={path==='/my-plans'?'active':''}><Columns3 size={17}/>My plans</Link></nav><div className="account"><Link href="/settings" aria-label="Account settings"><Settings size={18}/><span>{user.email}</span></Link><button className="icon-button" aria-label="Sign out" onClick={async()=>{try{await api('/auth/logout',send('POST'));router.push('/login');}catch(e){setError((e as Error).message);}}}><LogOut size={17}/></button></div></header>{error&&<Notice error>{error}</Notice>}{!user.verified&&<div className="verify-banner">Verify your email to enable reminders.<Link href="/settings">Manage account <ArrowUpRight size={13}/></Link></div>}<main className="app-main">{children}</main><footer className="footer"><span>Made for getting out in Atlanta.</span><Link href="/privacy">Privacy & data</Link><span>All times Eastern</span></footer></Auth.Provider>;
}
