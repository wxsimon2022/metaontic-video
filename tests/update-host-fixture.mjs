/** Shape returned by the native pluginManager.updateBundle remote method. */
export const hostUpdateResult = (result, extra = {}) => ({ok:true,value:{from:'3.0.0',to:result.version,step:'install',result,...extra}});
