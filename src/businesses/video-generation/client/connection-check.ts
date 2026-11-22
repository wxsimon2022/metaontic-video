/** 只读设置验证；取消、改稿或宿主修订变化后不显示旧结果。 */
export function createConnectionCheckController({setState,readSnapshot,fetcher=(...args:any[])=>fetch(...args as [any,any])}:any) {
  let request=0,controller:any=null,cachedTextModels:string[]=[];
  function dispose(){request++;controller?.abort();controller=null;}
  function invalidate(clearModels=false){
    dispose();
    if(clearModels)cachedTextModels=[];
    setState({status:'idle',checks:[],textModels:cachedTextModels});
  }
  async function run(ready:boolean) {
    if(!ready||controller)return;
    const id=++request,revision=readSnapshot()?.revision;
    const abort=new AbortController();controller=abort;setState({status:'working',checks:[],textModels:cachedTextModels});
    const timeout=setTimeout(()=>abort.abort(),16000);
    try {
      const response=await fetcher('/metaontic-video/check-connection',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:abort.signal});
      const result=await response.json();
      if(id!==request||readSnapshot()?.revision!==revision)return;
      if(!response.ok||!Array.isArray(result?.checks)||!result.checks.length)throw Error();
      const textModels=result.checks.find((check:any)=>check.target==='text')?.availableModels;
      if(Array.isArray(textModels))cachedTextModels=[...new Set(textModels.filter((model:any)=>typeof model==='string'&&model.trim()).map((model:string)=>model.trim()))];
      setState({status:'done',checks:result.checks,textModels:cachedTextModels});
    }catch{if(id===request&&readSnapshot()?.revision===revision)setState({status:'failed',checks:[],textModels:cachedTextModels});}
    finally{clearTimeout(timeout);if(id===request)controller=null;}
  }
  return {run,invalidate,dispose};
}
