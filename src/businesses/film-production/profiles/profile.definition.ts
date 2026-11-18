export type Dimension = 'genre' | 'format' | 'purpose' | 'style_profile';
export type Entry = {label:string; rules:Partial<Record<string,string>>; criterion:string};
export const entry=(label:string,creative:string,screenwriter:string,storyboard:string,criterion:string):Entry=>({label,rules:{creative,screenwriter,storyboard,reviewer:criterion},criterion});
