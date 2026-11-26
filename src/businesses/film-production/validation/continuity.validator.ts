import { sourceRevisions } from '../contracts/index.js';
function registry(items: any, key: string) {
  if (!Array.isArray(items)) throw Error(`INVALID_REGISTRY:${key}`);
  const ids=items.map(v=>v?.[key]);
  if(ids.some(id=>typeof id!=='string'||!id.trim())||new Set(ids).size!==ids.length) throw Error(`INVALID_REGISTRY_ID:${key}`);
  return new Map(items.map(v=>[v[key],v]));
}
function refs(ids: any, map: Map<any,any>, kind: string) {
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!map.has(id))) throw Error(`INVALID_REFERENCE:${kind}`);
}
export function validateReferences(stage: string, value: any, state: any) {
  const expected=sourceRevisions(state,stage);
  if(value.source_revisions !== undefined) {
    if(!value.source_revisions||typeof value.source_revisions!=='object'||Array.isArray(value.source_revisions)) throw Error('INVALID_SOURCE_REVISIONS');
    for(const [key,rev] of Object.entries(value.source_revisions)) if(expected[key]!==rev) throw Error(`SOURCE_REVISION_MISMATCH:${key}`);
    if(state.schema_version==='3.1.0' && Object.keys(expected).some(k=>value.source_revisions[k]!==expected[k])) throw Error('INCOMPLETE_SOURCE_REVISIONS');
  }
  const script=stage==='script'?value:state.artifacts.script?.data;
  const lines=script?.dialogue_lines || script?.dialogue || [];
  const dialogue=lines.some(d=>d.dialogue_id!==undefined)?registry(lines,'dialogue_id'):new Map();
  if(stage==='script' && dialogue.size) for(const line of lines) if(typeof line.exact_text!=='string'||!line.exact_text.trim()) throw Error('INVALID_DIALOGUE_TEXT');
  if(stage==='script'||stage==='creative') return;
  const assets=stage==='assets'?value:state.artifacts.assets?.data;
  if(!assets) return;
  const characters=registry(assets.characters,'character_id');
  const scenes=registry(assets.scenes,'scene_id');
  const locations=assets.locations===undefined?null:registry(assets.locations,'location_id');
  const states=assets.scene_states===undefined?null:registry(assets.scene_states,'scene_state_id');
  const props=assets.props===undefined?null:registry(assets.props,'prop_id');
  const costumes=registry(assets.characters.flatMap(c=>c.costumes || []),'costume_id');
  const check=(item:any)=>{
    if(item.character_ids!==undefined) refs(item.character_ids,characters,'character');
    if(item.location_id!==undefined && (!locations||!locations.has(item.location_id))) throw Error('INVALID_REFERENCE:location');
    if(item.scene_state_id!==undefined) {
      const current=states?.get(item.scene_state_id);
      if(!current || (item.location_id!==undefined && current.location_id!==item.location_id)) throw Error('INVALID_REFERENCE:scene_state');
    }
    if(item.prop_ids!==undefined) refs(item.prop_ids,props || new Map(),'prop');
    if(item.costume_ids!==undefined) refs(item.costume_ids,costumes,'costume');
  };
  if(stage==='assets') {
    for(const scene of assets.scenes) {
      check(scene);
      if(script?.scenes && !script.scenes.some(s=>s.scene_id===scene.scene_id)) throw Error('SCRIPT_SCENE_REF_MISMATCH');
    }
    if(script?.scenes?.some(s=>!scenes.has(s.scene_id))) throw Error('MISSING_SCRIPT_SCENE');
    for(const current of assets.scene_states || []) {
      check(current);
      if(current.scene_id!==undefined&&!scenes.has(current.scene_id))throw Error('INVALID_REFERENCE:scene_state_scene');
    }
    for(const costume of costumes.values()) if(costume.character_id!==undefined&&!characters.has(costume.character_id)) throw Error('INVALID_REFERENCE:costume_owner');
    if(script?.characters) {
      const cast=registry(script.characters,'character_id');
      if([...cast.keys()].some(id=>!characters.has(id)) || [...characters.keys()].some(id=>!cast.has(id))) throw Error('SCRIPT_CHARACTER_COVERAGE');
    }
    for(const line of lines) if(!characters.has(line.speaker_id)) throw Error('INVALID_REFERENCE:speaker');
  }
  if(stage==='shots'||stage==='prompts') {
    const shots=stage==='shots'?value.shots:state.artifacts.shots.data.shots;
    const shotMap=new Map(shots.map(s=>[s.shot_id,s]));
    for(const item of stage==='shots'?shots:value.prompts) {
      check(item);
      const shot:any=stage==='shots'?item:shotMap.get(item.shot_id);
      if(!shot) throw Error('INVALID_REFERENCE:shot');
      if(stage==='shots') {
        const scene=scenes.get(shot.scene_id);
        if(!scene) throw Error('INVALID_REFERENCE:scene');
        const current=states?.get(shot.scene_state_id);
        if(current?.scene_id!==undefined&&current.scene_id!==shot.scene_id)throw Error(`SHOT_SCENE_STATE_MISMATCH:镜头 ${shot.shot_id} 的地点状态不属于场次 ${shot.scene_id}，请引用该场次已登记的状态，不要仅替换地点编号。`);
        const registeredLocation=current?.scene_id===shot.scene_id&&current?.location_id===shot.location_id;
        if(shot.location_id!==undefined && scene.location_id!==shot.location_id&&!registeredLocation) throw Error(`SHOT_LOCATION_MISMATCH:镜头 ${shot.shot_id} 的地点 ${shot.location_id} 未绑定场次 ${shot.scene_id}；请选择场次主地点 ${scene.location_id} 或该场次已登记的地点状态，不要为通过校验随意修改画面地点。`);
        if(shot.chapter_id!==undefined && script?.scenes && !script.scenes.some(s=>s.scene_id===shot.scene_id&&s.chapter_id===shot.chapter_id)) throw Error('SHOT_CHAPTER_MISMATCH');
        for(const id of shot.costume_ids || []) if(!shot.character_ids.includes(costumes.get(id)?.character_id)) throw Error('COSTUME_CHARACTER_MISMATCH');
      }
      if(item.dialogue_refs!==undefined) {
        refs(item.dialogue_refs,dialogue,'dialogue');
        for(const id of item.dialogue_refs) {
          const line=dialogue.get(id);
          if(line.scene_id!==shot.scene_id || !shot.character_ids.includes(line.speaker_id)) throw Error('DIALOGUE_CONTEXT_MISMATCH');
          if(stage==='prompts' && !(shot.dialogue_refs || []).includes(id)) throw Error('DIALOGUE_NOT_IN_SHOT');
        }
      }
      if(stage==='prompts') {
        for(const id of shot.dialogue_refs || []) if(!item.prompt.includes(dialogue.get(id)?.exact_text)) throw Error('DIALOGUE_TEXT_MISMATCH');
        for(const key of ['location_id','scene_state_id','duration_ms']) if(item[key]!==undefined&&item[key]!==shot[key]) throw Error(`PROMPT_SHOT_MISMATCH:${key}`);
      }
    }
    if(stage==='shots' && dialogue.size) {
      const covered=new Set(shots.flatMap(s=>s.dialogue_refs || []));
      if([...dialogue.keys()].some(id=>!covered.has(id))) throw Error('DIALOGUE_COVERAGE_GAP');
    }
  }
}
