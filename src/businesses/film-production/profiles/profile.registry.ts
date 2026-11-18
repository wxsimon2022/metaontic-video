import type { Dimension, Entry } from './profile.definition.js';
import genre_comedy from './genres/comedy.js';
import genre_drama from './genres/drama.js';
import genre_documentary from './genres/documentary.js';
import genre_animation from './genres/animation.js';
import genre_romance from './genres/romance.js';
import genre_thriller from './genres/thriller.js';
import format_skit from './formats/skit.js';
import format_short_film from './formats/short-film.js';
import format_micro_drama from './formats/micro-drama.js';
import format_series from './formats/series.js';
import format_interview from './formats/interview.js';
import format_commercial from './formats/commercial.js';
import format_vlog from './formats/vlog.js';
import format_music_video from './formats/music-video.js';
import purpose_entertainment from './purposes/entertainment.js';
import purpose_promotion from './purposes/promotion.js';
import purpose_education from './purposes/education.js';
import purpose_sales from './purposes/sales.js';
import style_profile_rural_documentary from './styles/rural-documentary.js';
import style_profile_minidv from './styles/minidv.js';
import style_profile_cinematic_realism from './styles/cinematic-realism.js';
import style_profile_stylized_animation from './styles/stylized-animation.js';
export const PROFILE_REGISTRY: Record<Dimension,Record<string,Entry>> = {
genre:{comedy:genre_comedy,drama:genre_drama,documentary:genre_documentary,animation:genre_animation,romance:genre_romance,thriller:genre_thriller},
format:{skit:format_skit,short_film:format_short_film,micro_drama:format_micro_drama,series:format_series,interview:format_interview,commercial:format_commercial,vlog:format_vlog,music_video:format_music_video},
purpose:{entertainment:purpose_entertainment,promotion:purpose_promotion,education:purpose_education,sales:purpose_sales},
style_profile:{rural_documentary:style_profile_rural_documentary,minidv:style_profile_minidv,cinematic_realism:style_profile_cinematic_realism,stylized_animation:style_profile_stylized_animation}
};
