function checkShaderStatus(p_Shader, p_Identifier = "")
{
    if(!gl.getShaderParameter(p_Shader, gl.COMPILE_STATUS))
    {
        console.error(`Shader ${p_Identifier} compilation failed`);
        console.error(gl.getShaderInfoLog(p_Shader));
        return false
    }
    console.log(`Shader ${p_Identifier} compiled`);
    return true;
}

function checkProgramLinkStatus(p_Program)
{
    if(!gl.getProgramParameter(p_Program, gl.LINK_STATUS))
    {
        console.error(`Shader program linking failed`);
        console.error(gl.getProgramInfoLog(p_Program));
        return false;
    }
    return true;
}

class Utils
{
    /**
     * @brief - Creates shader program based on supplied shader relative paths (VS & FS)
     * @param {String} p_Path - relative path of shaders 
     * @param {String} p_AltPath - optional realtive path to fragment shader (p_Path is then rel. path to vertex shader)
     * @returns 
     */
    static createShaderProgramFromSource(p_Path, p_AltPath = null)
    {
        let vsPath = `${p_Path}.vert`;
        let fsPath = `${(p_AltPath) ? p_AltPath : p_Path}.frag`;

        return Utils.createProgram(
            Utils.loadShaderSource(vsPath),
            Utils.loadShaderSource(fsPath)
        );
    }

    /**
     * @brief - fetches shader source from path
     * @param {String} p_Path 
     * @returns {String} shader source code
     */
    static loadShaderSource(p_Path)
    {
        // Old fashion xhr
        let req = new XMLHttpRequest();
        req.open("GET", p_Path, false);
        req.send(null);
        return (req.status == 200) ? req.responseText : null
    }

    /**
     * @brief - Compiles shaders and links shader program
     * @param {String} src_VS - GLSL vertex shader source as string
     * @param {String} src_FS - GLSL fragment shader source as string
     * @returns 
     */
    static createProgram(src_VS, src_FS)
    {
        var program = gl.createProgram();

        // Compile vertex & fragment shaders
        let vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, src_VS);
        gl.compileShader(vs);
        checkShaderStatus(vs, "Vertex");

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        const fsSrcFull =`${this.getFsHeader()}\n${src_FS}`;
        gl.shaderSource(fs, fsSrcFull);
        gl.compileShader(fs);
        checkShaderStatus(fs, "Fragment");

        // Link program 
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if(checkProgramLinkStatus(program))
            return program;

        return null;
    }

    /**
     * @brief - Loads image data, returns loaded HTMLImage via promise
     * @param {String} p_ImgPath 
     * @returns Promise
     */
    static loadTextureFromPath(p_ImgPath)
    {  
        // Asynchronously load texture image
        return new Promise((resolve, reject) => {
            var img = new Image();
            img.onload = ()=>{
                resolve(img);
            };
            img.onerror = ()=>{
                reject(`Failed to load image texture from path ${p_ImgPath}`);
            }   
            img.src = p_ImgPath;
        });
    }

    static setTexWrapping(p_ClampS = gl.CLAMP_TO_EDGE, p_ClampT = gl.CLAMP_TO_EDGE)
    {
        // Wrapping - for non-power-of-two textures, clamp must be set to "CLAMP_TO_EDGE", otherwise no data are displayed..
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, p_ClampS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, p_ClampT);
    }

    static setTexFiltering(p_MinFilter = gl.NEAREST, p_MagFilter = gl.NEAREST)
    {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, p_MinFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, p_MagFilter);
    }

    /**
     * @brief - Creates temporary texImage for currently bound texture (single pixel, solid color)
     * @param {Array} p_Color - 4-component vector RGBA
     */
    static createTempTexture(p_Color = null)
    {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, 
            new Uint8Array(p_Color ? p_Color : [
                100, 100, 20, 255
            ])
        );
    }

    /**
     * @brief - Rescales canvas to respect image size and aspect ratio
     * @param {HTMLCanvasElement} p_Canvas 
     * @param {HTMLImageElement} p_Image 
     * @returns 
     */
    static rescaleCanvasToImage(p_Canvas, p_Image)
    {
        const CANVAS_MAX_WIDTH = document.querySelector('div.canvas_wrapper').offsetWidth;//728;
        const CANVAS_MAX_HEIGHT = document.querySelector('div.canvas_wrapper').offsetHeight;

        console.log(`W: ${CANVAS_MAX_WIDTH} H: ${CANVAS_MAX_HEIGHT}`);

        let currW = p_Image.width;
        let currH = p_Image.height;
        const aspectRatio = IContext.ImgAspectRatio;

        if(currW > CANVAS_MAX_WIDTH)
        {
            currW = CANVAS_MAX_WIDTH;
            currH = CANVAS_MAX_WIDTH / aspectRatio;
        }

        if(currH > CANVAS_MAX_HEIGHT)
        {
            currH = CANVAS_MAX_HEIGHT;
            currW = CANVAS_MAX_HEIGHT * aspectRatio;
        }

        p_Canvas.width = currW;
        p_Canvas.height = currH;

        gl.viewport(0,0,currW,currH);

        return p_Canvas;
    }

    /**
     * @brief - Rescales canvas to fit the canvas container div
     * @param {HTMLCanvasElement} p_Canvas 
     * @returns 
     */
    static rescaleCanvas(p_Canvas)
    {
        const aspectRatio = IContext.ImgAspectRatio;
        const CANVAS_MAX_WIDTH = document.querySelector('div.canvas_wrapper').offsetWidth;
        const CANVAS_MAX_HEIGHT = document.querySelector('div.canvas_wrapper').offsetHeight;
       
        let currW = CANVAS_MAX_WIDTH;
        let currH = CANVAS_MAX_HEIGHT;

        if(CANVAS_MAX_WIDTH / aspectRatio > CANVAS_MAX_HEIGHT)
        {
            currW = Math.floor(currH * aspectRatio);
        }
        else if(CANVAS_MAX_HEIGHT * aspectRatio > CANVAS_MAX_WIDTH)
        {
            currH = currW / aspectRatio;
        }
        
        p_Canvas.width = currW;
        p_Canvas.height = currH;

        gl.viewport(0,0,currW,currH);

        return p_Canvas;
    }

    /**
     * @brief - Sets value to range input label (image adjust. form)
     * @param {HTMLElementId} p_ElementId 
     * @param {Number} p_Value 
     */
    static setLabelValue(p_ElementId, p_Value)
    {
        document.getElementById(p_ElementId).innerHTML = (Number.isInteger(p_Value)) ? p_Value : (parseFloat(p_Value)).toFixed(2);
    }

    /**
     * @brief - Renders one frame
     */
    static render()
    {
        //gl.useProgram(AppContext.Programs.MAIN);
        gl.clearColor(0.62, 0.85, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        /*gl.useProgram(AppContext.Programs.GAUSS);
        gl.clearColor(0.62, 0.85, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);*/

        console.log("Image rendered");
    }

    /**
     * @brief - logs message into an on-screen 'console' panel (html)
     * @param {String} p_Message 
     * @param {Boolean} p_IsError 
     */
    static logMessage(p_Message, p_IsError = false)
    {
        const divMsg = document.createElement("div");
        divMsg.innerHTML = `| ${p_Message}`;
        if(p_IsError)
            divMsg.style.color = "red";
        document.querySelector(".console_output").appendChild(divMsg);
    }

    /**
     * @brief - Returns pre-generated fragment shader header with defines etc.
     */
    static getFsHeader()
    {
        return `
#version ${GLSL_VERSION}\n
precision mediump float;

#define MAX_LAYERS ${DEFINE_MAX_LAYERS}\n
#define GAUSS_BLUR_MAX_RADIUS ${DEFINE_GAUSS_MAX_RADIUS}\n
#define CHECKER_TILE_WIDTH ${DEFINE_CHECKER_WIDTH}`;
    }

    // Quad screen-space coordinates + UV coordinates
    static QuadData = new Float32Array([
        -1.0, -1.0,     0.0, 0.0,
        1.0, -1.0,      1.0, 0.0, 
        -1.0, 1.0,      0.0, 1.0,

        1.0, -1.0,      1.0, 0.0,
        1.0, 1.0,       1.0, 1.0,
        -1.0, 1.0,      0.0, 1.0
    ]);
}

export {Utils}



