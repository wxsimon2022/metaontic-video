/** 稳定的核心契约；历史与类型专项扩展保留在明确的扩展字段中。 */
export type Stage = 'creative'|'script'|'assets'|'shots'|'prompts'|'review';
export type Revisions = Partial<Record<Stage,number>>;
export interface Dialogue { dialogue_id:string; speaker_id:string; scene_id:string; exact_text:string; }
export interface StoryBeat { action?:string; dialogue_ref?:string; }
export interface ScriptScene {
 scene_id:string; chapter_id:string; duration_ms:number; scene_goal:string; key_actions:string[];
 entry_state:string; exit_state:string; beats?:StoryBeat[]; location?:string; time_of_day?:string;
}
export interface ScriptChapter { chapter_id:string; title?:string; duration_ms:number; scene_ids:string[]; }
export interface ScriptData {
 script_id?:string; approved_creative_revision?:number; screenplay?:string; synopsis?:string;
 characters:Array<{character_id:string;name?:string;[key:string]:unknown}>;
 chapters:ScriptChapter[]; scenes:ScriptScene[]; dialogue:Dialogue[];
}
export interface ReviewIssue { issue_id:string; severity:'CRITICAL'|'MAJOR'|'MINOR'|'INFO'; status:'OPEN'|'IN_PROGRESS'|'RESOLVED'|'VERIFIED'|'WONT_FIX'; description:string; evidence:string; }
export interface ReviewReport {
 review_status:'PASS'|'PASS_WITH_WARNINGS'|'REVISE_REQUIRED'|'BLOCKED'|'NOT_EVALUATED';
 scores:Record<string,number|null>; issues:ReviewIssue[]; delivery_allowed:boolean; blocking_issue_count?:number; passed?:boolean; weighted_score?:number;
}
