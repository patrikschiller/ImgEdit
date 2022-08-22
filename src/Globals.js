/**
 * @var {WebGLRenderingContex} gl - Global variable used to access WebGL API
 */
var gl = null;

/**
 * @var {WebGLExtension} oes_vao_ext - WebGL extension for Vertex Array Objects
 */
var oes_vao_ext = null;

/**
 * @var {HTMLCanvasElement}
 */
var Canvas = null;  

/**
 * @var {ImageContext}
 */
var IContext = null;

var GlContext = {
    Programs : {
        MAIN : null,
        GAUSS : null
    },
    VAO: null,
    VBO: null
};

// Shader definitions  
//  - injected into glsl code in pre-compile time 
const GLSL_VERSION              = 100;
const DEFINE_GAUSS_MAX_RADIUS   = 5;
const DEFINE_CHECKER_WIDTH      = 8;
DEFINE_MAX_LAYERS               = 4;

// WebGL querried properties
PROP_WGL_TEX_MAX_RES = null;


// https://stackoverflow.com/questions/27922232/how-to-feature-detect-es6-modules
let supported = null;
async function modulesSupported() {
   if (supported !== null) {
      return supported;
   }

   try {
     let module = await new Function("return (async () => {return await import('data:application/javascript,export%20let%20canary%20=%201;')})")()()
     supported = module && module.canary && module.canary == 1;
   } catch(e) {
     supported = false;
   }

   return supported;
}
modulesSupported().then(r => {
    if(!r)
    {
        alert("JavaScript ES6 modules not supported!");
    }
});