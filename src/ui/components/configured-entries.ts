/** 订阅已保存配置并成组装卸宿主入口；卸载后忽略迟到的订阅通知。 */
export function followConfiguredEntries(form:any, key:string, registrations:Array<()=>unknown>, defaultEnabled=true) {
  let active=false, disposed=false, known=defaultEnabled;
  let cleanups:Array<()=>void>=[];
  const close=()=>{
    const pending=cleanups;cleanups=[];active=false;
    for(const off of pending.reverse()) { try { off(); } catch { /* 继续释放其余入口。 */ } }
  };
  const sync=()=>{
    if(disposed)return;
    try { const value=form?.getSnapshot?.()?.value?.[key];known=value===undefined?defaultEnabled:value===true; } catch { return; }
    if(known===active)return;
    if(!known){close();return;}
    try {
      for(const register of registrations){const off=register();if(typeof off==='function')cleanups.push(off as ()=>void);}
      active=true;
    }catch(error){close();throw error;}
  };
  sync();
  let unsubscribe:unknown;
  try { unsubscribe=form?.subscribe?.(sync); } catch { /* 旧宿主没有订阅时保留初始值。 */ }
  return ()=>{disposed=true;try { if(typeof unsubscribe==='function')unsubscribe(); } finally { close(); }};
}
