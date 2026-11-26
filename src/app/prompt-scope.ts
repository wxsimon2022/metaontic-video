/** 只依据成功的业务工具结果切换会话规则，不从用户文本推断审批或制作状态。 */
export function createPromptScope() {
  const sessions = new Map<string, 'creation' | 'production'>();
  const anonymous = new WeakMap<object, 'creation' | 'production'>();
  const idOf = (session: any) => session?.id || session?.header?.id;
  const sessionOf = (context: any) => context?.agent?.session;
  return {
    read(context: any): 'creation' | 'production' {
      const session = sessionOf(context);
      return (idOf(session) ? sessions.get(idOf(session)) : session && anonymous.get(session)) || 'production';
    },
    observe(name: string, args: any, result: any, exec: any) {
      const session = sessionOf(exec);
      if (!session || !result || result.error || result.isError || ['blocked', 'failed', 'error'].includes(result.status)) return;
      let scope: 'creation' | 'production';
      if (name === 'film_project' && ['create','read','next','route','submit','approve','revise','configure_profile','chapter_plan','chapter_submit','compile'].includes(args.action)) {
        scope = args.action === 'compile' && result.production?.videoProjectId ? 'production' : 'creation';
      } else if (name === 'video_project' && ['prepare','status','storyboard','review','review_segment'].includes(args.action)) {
        scope = 'production';
      } else return;
      if (idOf(session)) {
        sessions.delete(idOf(session));
        sessions.set(idOf(session), scope);
        if (sessions.size > 128) sessions.delete(sessions.keys().next().value!);
      } else anonymous.set(session, scope);
    },
  };
}
