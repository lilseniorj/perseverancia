// Fotos reales de Perseverance (API raw_images de la NASA), elegidas a mano después de verlas:
// a color, con horizonte, el brazo sobre el suelo o rocas de cerca. Sin cielo vacío, sol, calibración
// ni miniaturas. Descargadas y revisadas el 24-oct-2026, sols 2009–2018.
// Fuente: https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2
export const CAMERAS = {
  mastcam: {
    part: "Mastcam_Z_cams",
    name: "Mastcam-Z",
    role: "Los ojos de Percy, con zoom, en lo alto del mástil",
    photos: [
      {"id":"ZL0_2016_0845910732_443EBY_N0920000ZCAM10049_1100LMJ","instrument":"MCZ_LEFT","sol":2016,"utc":"2026-10-22T03:37:25.920Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02016/ids/edr/browse/zcam/ZL0_2016_0845910732_443EBY_N0920000ZCAM10049_1100LMJ01_1200.jpg","caption":"Roca raspada por el abrasor: el círculo claro es roca fresca"},
      {"id":"ZR0_2013_0845643693_400EBY_N0920000ZCAM10046_0480LMJ","instrument":"MCZ_RIGHT","sol":2013,"utc":"2026-10-19T01:26:56.798Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02013/ids/edr/browse/zcam/ZR0_2013_0845643693_400EBY_N0920000ZCAM10046_0480LMJ01_1200.jpg","caption":"Huellas de las ruedas de Percy en la arena"},
      {"id":"ZL0_2015_0845829964_832EBY_N0920000ZCAM10048_1100LMJ","instrument":"MCZ_LEFT","sol":2015,"utc":"2026-10-21T05:12:06.273Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02015/ids/edr/browse/zcam/ZL0_2015_0845829964_832EBY_N0920000ZCAM10048_1100LMJ01_1200.jpg","caption":"Roca de cerca con la sombra del rover"},
      {"id":"ZR0_2014_0845728502_660EBY_N0920000ZCAM10047_1100LMJ","instrument":"MCZ_RIGHT","sol":2014,"utc":"2026-10-20T01:00:23.476Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02014/ids/edr/browse/zcam/ZR0_2014_0845728502_660EBY_N0920000ZCAM10047_1100LMJ01_1200.jpg","caption":"Rocas partidas del suelo marciano"},
      {"id":"ZR0_2016_0845904948_649EBY_N0920000ZCAM04493_1100LMJ","instrument":"MCZ_RIGHT","sol":2016,"utc":"2026-10-22T02:01:18.866Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02016/ids/edr/browse/zcam/ZR0_2016_0845904948_649EBY_N0920000ZCAM04493_1100LMJ01_1200.jpg","caption":"Suelo sembrado de piedras"},
    ],
  },
  navcam: {
    part: "NavCams",
    name: "NavCam",
    role: "Cámaras para planear por dónde manejar",
    photos: [
      {"id":"NRF_2010_0845370078_987ECM_N0920000NCAM13009_04_195J","instrument":"NAVCAM_RIGHT","sol":2010,"utc":"2026-10-15T21:26:25.500Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02010/ids/edr/browse/ncam/NRF_2010_0845370078_987ECM_N0920000NCAM13009_04_195J01_1200.jpg","caption":"Colinas en el horizonte"},
      {"id":"NRF_2009_0845300908_284ECM_N0920000NCAM02009_01_195J","instrument":"NAVCAM_RIGHT","sol":2009,"utc":"2026-10-15T02:13:34.149Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02009/ids/edr/browse/ncam/NRF_2009_0845300908_284ECM_N0920000NCAM02009_01_195J01_1200.jpg","caption":"La cubierta de Percy frente al paisaje"},
      {"id":"NRF_2011_0845478216_410ECM_N0920000NCAM00347_01_195J","instrument":"NAVCAM_RIGHT","sol":2011,"utc":"2026-10-17T03:28:44.377Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02011/ids/edr/browse/ncam/NRF_2011_0845478216_410ECM_N0920000NCAM00347_01_195J01_1200.jpg","caption":"El brazo robótico y su sombra sobre el suelo"},
      {"id":"NLF_2010_0845369681_035EBY_N0920000SCAM02010_00_0LLJ","instrument":"NAVCAM_LEFT","sol":2010,"utc":"2026-10-15T21:19:47.755Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02010/ids/edr/browse/ncam/NLF_2010_0845369681_035EBY_N0920000SCAM02010_00_0LLJ01_1200.jpg","caption":"Rocas de cerca frente al rover"},
      {"id":"NRF_2009_0845300490_318ECM_N0920000NCAM03009_04_195J","instrument":"NAVCAM_RIGHT","sol":2009,"utc":"2026-10-15T02:06:37.158Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02009/ids/edr/browse/ncam/NRF_2009_0845300490_318ECM_N0920000NCAM03009_04_195J01_1200.jpg","caption":"Horizonte amplio del cráter"},
    ],
  },
  hazcam: {
    part: "hazcams_front",
    name: "Hazcam delantera",
    role: "Vigilan obstáculos frente a las ruedas",
    photos: [
      {"id":"FLF_2017_0846002466_012ECM_N0920000FHAZ00206_01_295J","instrument":"FRONT_HAZCAM_LEFT_A","sol":2017,"utc":"2026-10-23T05:06:18.065Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02017/ids/edr/browse/fcam/FLF_2017_0846002466_012ECM_N0920000FHAZ00206_01_295J01_1200.jpg","caption":"El brazo trabajando sobre el suelo, con colinas al fondo"},
      {"id":"FLF_2017_0846007883_241ECM_N0920000FHAZ00216_01_295J","instrument":"FRONT_HAZCAM_LEFT_A","sol":2017,"utc":"2026-10-23T06:36:35.183Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02017/ids/edr/browse/fcam/FLF_2017_0846007883_241ECM_N0920000FHAZ00216_01_295J01_1200.jpg","caption":"La torreta del brazo sobre una roca"},
      {"id":"FRF_2018_0846088669_950ECM_N0920000FHAZ00203_04_195J","instrument":"FRONT_HAZCAM_RIGHT_A","sol":2018,"utc":"2026-10-24T05:03:02.487Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02018/ids/edr/browse/fcam/FRF_2018_0846088669_950ECM_N0920000FHAZ00203_04_195J01_1200.jpg","caption":"Rueda junto a una roca grande"},
      {"id":"FRF_2018_0846090574_426ECM_N0920000FHAZ02008_03_095J","instrument":"FRONT_HAZCAM_RIGHT_A","sol":2018,"utc":"2026-10-24T05:34:46.493Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02018/ids/edr/browse/fcam/FRF_2018_0846090574_426ECM_N0920000FHAZ02008_03_095J01_1200.jpg","caption":"Rocas justo delante de las ruedas"},
      {"id":"FLF_2018_0846088669_950ECM_N0920000FHAZ00203_04_195J","instrument":"FRONT_HAZCAM_LEFT_A","sol":2018,"utc":"2026-10-24T05:03:02.477Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02018/ids/edr/browse/fcam/FLF_2018_0846088669_950ECM_N0920000FHAZ00203_04_195J01_1200.jpg","caption":"Rueda sobre ondas de arena"},
    ],
  },
  watson: {
    part: "WATSON",
    name: "WATSON",
    role: "Lupa en la punta del brazo robótico",
    photos: [
      {"id":"SIF_2011_0845480341_156EBY_N0920000SRLC00729_0000LMJ","instrument":"SHERLOC_WATSON","sol":2011,"utc":"2026-10-17T04:04:35.494Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02011/ids/edr/browse/shrlc/SIF_2011_0845480341_156EBY_N0920000SRLC00729_0000LMJ01_1200.jpg","caption":"Abrasión circular: el interior de una roca, a centímetros"},
      {"id":"SIF_2014_0845733781_410EBY_N0920000SRLC00648_0000LMJ","instrument":"SHERLOC_WATSON","sol":2014,"utc":"2026-10-20T02:28:35.509Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02014/ids/edr/browse/shrlc/SIF_2014_0845733781_410EBY_N0920000SRLC00648_0000LMJ01_1200.jpg","caption":"Borde de una abrasión, con granos minerales"},
      {"id":"SIF_2014_0845734579_699EBY_N0920000SRLC00747_0000LMJ","instrument":"SHERLOC_WATSON","sol":2014,"utc":"2026-10-20T02:41:54.511Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02014/ids/edr/browse/shrlc/SIF_2014_0845734579_699EBY_N0920000SRLC00747_0000LMJ01_1200.jpg","caption":"Textura de una roca vista muy de cerca"},
      {"id":"SIF_2014_0845735079_058EBY_N0920000SRLC00741_0000LMJ","instrument":"SHERLOC_WATSON","sol":2014,"utc":"2026-10-20T02:50:14.524Z","url":"https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02014/ids/edr/browse/shrlc/SIF_2014_0845735079_058EBY_N0920000SRLC00741_0000LMJ01_1200.jpg","caption":"Arena y granos sueltos"},
    ],
  },
};
