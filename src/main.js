import {Utils} from "./Utils.js";
import ImageLayer from "./ImageLayer.js"
import ImageContext from "./ImageContext.js";

var mouseDown;

function initApp()
{
    // Get device parameters
    const numTexMax = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    const numTexMaxCombined = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    console.log(`[GL] Max. available tex. units: ${numTexMax} (${numTexMaxCombined} combined)`);
    Utils.logMessage(`[GL] Max. available tex. units: ${numTexMax}`);
    console.log(`[GL] Max. tex. size: ${maxTexSize}`);
    Utils.logMessage(`[GL] Max. tex. size: ${maxTexSize}`);

    DEFINE_MAX_LAYERS = numTexMax-2;
    PROP_WGL_TEX_MAX_RES = maxTexSize;
    document.getElementById("layers_display_label").innerHTML = `Layers 0/${DEFINE_MAX_LAYERS}`

    // Image context
    IContext = new ImageContext();

    // Shaders
    GlContext.Programs.MAIN = Utils.createShaderProgramFromSource(
        "src/shaders/image_adjustor"
    );
    GlContext.Programs.GAUSS = Utils.createShaderProgramFromSource(
        "src/shaders/image_adjustor",
        "src/shaders/gauss_blur"
    );

    // Geometry
    GlContext.VAO = oes_vao_ext.createVertexArrayOES();
    oes_vao_ext.bindVertexArrayOES(GlContext.VAO);

    GlContext.VBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, GlContext.VBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Utils.QuadData), gl.STATIC_DRAW);

    // Vertex attributes
    // i) Vertex coordinates
    const attrLoc_Pos = gl.getAttribLocation(GlContext.Programs.MAIN, 'a_Position');
    gl.vertexAttribPointer(
        attrLoc_Pos, 
        2, gl.FLOAT, gl.FALSE, 4*4, 0
    );
    gl.enableVertexAttribArray(attrLoc_Pos);

    // ii) Vertex UV coordinates
    const attrLoc_Uv = gl.getAttribLocation(GlContext.Programs.MAIN, 'a_UV');
    gl.vertexAttribPointer(
        attrLoc_Uv, 
        2, gl.FLOAT, gl.FALSE, 4*4, 2*4
    );
    gl.enableVertexAttribArray(attrLoc_Uv);

    gl.useProgram(GlContext.Programs.MAIN);
    
    Utils.render();
}

function initWgl()
{
    Canvas = document.getElementById('wgl1_context');
    gl = Canvas.getContext('webgl');
    if(gl !== null)
    {
        Utils.logMessage(`[GL] WebGL1 available`);
        Canvas.style.backgroundColor = "rgba(200,255,200,0.0)";

        // Get VAO extension
        oes_vao_ext = gl.getExtension('OES_vertex_array_object');
        if(oes_vao_ext !== null)
        {
            console.log("[GL] VAO extension available");
            Utils.logMessage(`[GL] VAO ext. available`);
        }
        else
        {
            console.warn("[GL] VAO extension is not available");
            Utils.logMessage(`[GL] VAO ext. NOT available`);
        }

        initApp();
    }else{
        console.error("[GL] WebGL1 API not supported by your machine!")
        Utils.logMessage(`[GL] WebGL1 NOT available`);
        Canvas.style.backgroundColor =  "rgb(255,200,200)";
        document.querySelector(".canvas_error").style.visibility = "visible";
    }
}

function handleImageUpload(p_FilesLoaded, p_Event = null)
{
    // Extract uploaded file
    let file = p_FilesLoaded[0];

    // Create texture using uploaded file
    if(file.type == "image/png" || file.type == "image/jpeg")
    {
        const texFormat = (file.type == "image/png") ? gl.RGBA : gl.RGB;

        if(IContext.m_Layers.length >= DEFINE_MAX_LAYERS)
        {
            IContext.deleteImageLayer(IContext.m_Layers.length-1);
        }

        const texture = gl.createTexture();
        //gl.bindTexture(gl.TEXTURE_2D, texture);

        const LayerId = IContext.loadImageLayer(texture);
        IContext.getImageLayer(LayerId).registerImageTexture();

        // Create temp texture
        Utils.createTempTexture([45,45,45,255]);

        // Promise based image upload and texture creation
        Utils.loadTextureFromPath(
            URL.createObjectURL(p_FilesLoaded[0])
        ).then(
            // Resolve
            (image)=>{
                const IMAGE_MAX_RESOLUTION = 1024;
                gl.bindTexture(gl.TEXTURE_2D, texture);
            
                // Flip Y coordinate
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

                // WIP:  Rescale image if needed (mobile devices can't handle large textures..)
                if(image.width > IMAGE_MAX_RESOLUTION || image.height > IMAGE_MAX_RESOLUTION)
                {
                    //[image.width, image.height] = Utils.recomputeImageResolution(image.width, image.height);
                }

                console.log(`Img res: ${image.width}x${image.height}`);
                Utils.logMessage(`Input Img res: ${image.width}x${image.height}`);

                // Rescale canvas to respect image aspect ratio
                IContext.ImgAspectRatio = parseFloat(image.width) / parseFloat(image.height);
                Utils.rescaleCanvasToImage(Canvas, image);

                // Rescale canvas to maximum available size
                Utils.rescaleCanvas(Canvas);
                
                // Load image (currently from Image object)
                gl.texImage2D(gl.TEXTURE_2D, 0, texFormat, texFormat, gl.UNSIGNED_BYTE, image);
                let error = gl.getError();
                if(error != 0)
                {
                    Utils.logMessage(`[GL] WebGL error '${error}' in loading texture`, true);
                    if(image.width > PROP_WGL_TEX_MAX_RES || image.height > PROP_WGL_TEX_MAX_RES)
                    {
                        Utils.logMessage(`[GL] Image is too big and cannot be loaded into a texture`, true);
                    }
                }
       
                // Set texture parameters
                Utils.setTexWrapping();
                Utils.setTexFiltering(gl.LINEAR, gl.LINEAR);

                // Update uniforms
                IContext.getImageLayer(LayerId).setLayerProperties({
                    width : Canvas.width,
                    height: Canvas.height
                });

                IContext.setActiveLayer(LayerId);
                gl.uniform1i(
                    gl.getUniformLocation(GlContext.Programs.MAIN, 'u_ActiveLayer'),
                    parseInt(LayerId)
                );
                gl.uniform1i(
                    gl.getUniformLocation(GlContext.Programs.MAIN, 'u_LayersLoaded'),
                    parseInt(IContext.m_Layers.length)
                );
    
                document.querySelectorAll('.layer_handle').forEach((e)=>{
                    e.classList.remove('active');
                });

                // Create layer icon, insert it into layers display
                image.setAttribute('title', `${file.name}\n${image.width}x${image.height}px`);
                createLayerPlaceholder(LayerId, image);

                window.requestAnimationFrame(Utils.render);
                console.log("Image from path loaded");
            },
            // Reject
            (msg)=>{
                console.error(msg);
            }
        )

        window.requestAnimationFrame(Utils.render);
    }
}

function handleImageAdjust(p_Element)
{
    const layer = IContext.getImageLayer();
    const pos = p_Element.id.indexOf("_");
    layer.setUpdateProperty(
        p_Element.id.substring(pos+1),
        Number(p_Element.value)
    );
    window.requestAnimationFrame(Utils.render);
}

function handleEnableDisableEffect(p_Element)
{
    const currLayer = IContext.getImageLayer();
    const pos = p_Element.id.indexOf("_");
    currLayer.enableDisableProperty(
        p_Element.id.substring(pos+1)
    );
    
    window.requestAnimationFrame(Utils.render);
}

function createLayerPlaceholder(p_LayerId, p_Image)
{
    let div = document.createElement("div");
    div.classList.add("layer_handle");
    div.classList.add("active");
    div.setAttribute("layer_id", p_LayerId);

    // Add image
    div.appendChild(p_Image);

    // Add interface - enable/disable layer
    let layerUi = document.createElement("div");
    layerUi.classList.add("layerUi");
    let checkBox = document.createElement("input");
    checkBox.type = "checkbox";
    checkBox.id = `check_layer_${p_LayerId}`;
    checkBox.checked = "checked";
    checkBox.setAttribute("layer_id", p_LayerId);
    checkBox.addEventListener("change", (e)=>{
        layerCheckHandler(e);
    });
    layerUi.appendChild(checkBox);

    // Add interface - select blending mode
    layerUi.appendChild(createComboOption(p_LayerId, 0, "normal", true));
    layerUi.appendChild(createComboOption(p_LayerId, 1, "screen"));
    layerUi.appendChild(createComboOption(p_LayerId, 2, "multiply"));

    div.appendChild(layerUi);
    div.addEventListener("click", (e)=>{
        changeLayerHandler(e);
    }, {capture:false});
    document.getElementById('layers_display').appendChild(div);
}

function createComboOption(p_LayerId, p_Value, p_Label, p_Selected = false)
{
    const optContainer = document.createElement("span");
    optContainer.classList.add("optContainer");
    const optLabel = document.createElement("label");
    optLabel.setAttribute('for', `radio_${p_LayerId}`);
    optLabel.innerHTML = p_Label.substr(0,1);
    const opt = document.createElement("input");
    opt.type = "radio";
    opt.name = `radio_${p_LayerId}`;
    opt.id = `radio_${p_Value}`;
    opt.value = p_Value;
    optContainer.setAttribute('title', `Blend mode '${p_Label}'`);
    opt.before("s");
    if(p_Selected)
        opt.checked = true;
    opt.addEventListener("change", (e)=>{
        blendModeChangeHandler(e);
    });

    optContainer.appendChild(optLabel);
    optContainer.appendChild(opt);

    return optContainer;
}

// === Event handlers ===
function blendModeChangeHandler(e)
{
    const blendModeId = e.target.id.substr(e.target.id.indexOf("_")+1);
    const layerId = e.target.name.substr(e.target.name.indexOf("_")+1);
    IContext.getImageLayer(layerId).setBlendMode(blendModeId);
}

function layerCheckHandler(e)
{
    const layerId = e.target.getAttribute("layer_id");
    IContext.getImageLayer(layerId).enableDisableLayer();
}

function changeLayerHandler(e)
{
    const layerId = e.currentTarget.getAttribute("layer_id");

    IContext.setActiveLayer(layerId);
    gl.uniform1i(
        gl.getUniformLocation(GlContext.Programs.MAIN, 'u_ActiveLayer'),
        parseInt(layerId)
    );

    document.querySelectorAll(".layer_handle").forEach((el)=>{
        if(el != e.currentTarget)
        {
            el.classList.remove('active');
        }
        else
        {
            el.classList.add('active');
        }
    });
    Utils.render();
}

window.addEventListener(
    "load",()=>{
        initWgl();
        attachEventListeners();
        console.info("Application initialized");
    }
)

function attachEventListeners()
{
    let element_inputFile = document.querySelector(".input_file");
    element_inputFile.addEventListener("input", (e)=>{
        e.preventDefault();
        handleImageUpload(element_inputFile.files, e);
        e.target.value = null;
    });

    document.addEventListener('keydown', (e)=>{
        if(e.key == "r")
            Utils.render();
    });

    // Effect sliders
    document.querySelectorAll(".img_adjust_slider").forEach((slider)=>{
        slider.addEventListener("input", (e)=>{
            //console.log(e);
            e.preventDefault();
            handleImageAdjust(e.target);
        });
    });

    // Effect checkboxes
    document.querySelectorAll(".img_adjust_check").forEach((slider)=>{
        slider.addEventListener("input", (e)=>{
            e.preventDefault();
            handleEnableDisableEffect(e.target);
        });
    });

    // Resize canvas observer
    let observer = new ResizeObserver((m)=>{
        if(!mouseDown)
        {
            Canvas = Utils.rescaleCanvas(Canvas);
            Utils.render();
         }
    });

    observer.observe(
        document.querySelector(".canvas_wrapper"), 
        { attributes: true }
    );
}
