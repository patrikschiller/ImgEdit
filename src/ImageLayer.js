import { Utils } from "./Utils.js";

/**
 * @class ImageLayer
 * @brief Class representing one loaded image layer and its properties
 */
export default class ImageLayer
{
    m_Label = "";
    m_Texture = null;
    m_Id = -1;
    m_Res = {
        width : 0,
        height : 0,
        aspect : 1.0
    };

    m_ShaderLoc = {
        BrCoGaSa : null,
        HuGa : null,
        VpImgRes : null,
        Image : null
    }

    m_Props = {
        Enabled : {
            value : true,
            shaderLoc : null
        },
        BlendMode : {
            value : 0,
            shaderLoc : null
        },
        Brightness : {
            enabled : true,
            value : 1.0,
            shaderLoc : null,
            transform : 0.00390625
        },
        Contrast : {
            enabled : true,
            value : 100.0,
            shaderLoc : null,
            transform : 0.01
        },
        Gamma : {
            enabled : true,
            value : 100.0,
            shaderLoc : null,
            transform : 0.01
        },
        Saturation : {
            enabled : true,
            value : 100.0,
            shaderLoc : null,
            transform : 0.01
        },
        Hue : {
            enabled : true,
            value : 100.0,
            shaderLoc : null,
            transform : 0.01
        },
        GaussBlurRadius : {
            enabled : true,
            value : 0,
            shaderLoc : null,
            transform : 1
        }
    }

    constructor(p_Texture,p_Id, p_Label)
    {
        this.m_Label = p_Label;
        this.m_Texture = p_Texture;
        this.m_Id = p_Id;

        this.initLayer();

        console.log(`Layer ${this.m_Label} created`);
    }

    /**
     * @brief - Binds texture and activates texturing unit for the layer (sets tex. unit id in the shader)
     */
    registerImageTexture()
    {
        gl.activeTexture(gl.TEXTURE0 + this.m_Id);
        gl.bindTexture(gl.TEXTURE_2D, this.m_Texture);

        gl.uniform1i(
            this.m_ShaderLoc.Image,
            this.m_Id
        );
    }

    /**
     * @brief - Method used to append information that are available after the layer image is loaded
     * @param {*} p_Props 
     */
    setLayerProperties(p_Props)
    {
        this.m_Res.width = p_Props.width;
        this.m_Res.height = p_Props.height;
        this.m_Res.aspect = parseFloat(p_Props.width) / parseFloat(p_Props.height);

        gl.uniform2fv(
            this.m_ShaderLoc.VpImgRes,
            new Float32Array([parseFloat(this.m_Res.width), parseFloat(this.m_Res.height)])
        );
    }

    /**
     * @brief - Initializes the layer (glsl uniforms, properties, etc.)
     */
    initLayer()
    {
        // Setup shader uniform locations
        this.m_ShaderLoc.Image = gl.getUniformLocation(GlContext.Programs.MAIN, `u_Image[${this.m_Id}]`);
        this.m_ShaderLoc.VpImgRes = gl.getUniformLocation(GlContext.Programs.MAIN, `u_VpImgRes`);
        this.m_ShaderLoc.BrCoGaSa = gl.getUniformLocation(GlContext.Programs.MAIN, `u_Flag_BrCoGaSa[${this.m_Id}]`);
        this.m_ShaderLoc.HuGa = gl.getUniformLocation(GlContext.Programs.MAIN, `u_Flag_HuGa[${this.m_Id}]`);

        // Init shader properties
        for(let key in this.m_Props)
        {
            if(key != "Enabled" && key != "BlendMode")
            {
                this.setUpdateProperty(key);
                this.enableDisableProperty(key, true);
            }            
        }

        // Set layer active
        this.enableDisableLayer(true);
    }

    /**
     * @brief - Enables / disables image adjustment property (is propagated to the shader)
     * @param {String} p_Key 
     * @param {Boolean} p_Value 
     */
    enableDisableProperty(p_Key, p_Value = null)
    {
        let prop = this.m_Props[p_Key];

        if(prop)
        {
            prop.enabled = (p_Value != null) ? p_Value : !prop.enabled;
            this.setEffectFlags();
        }
    }

    /**
     * @brief - Sets property value (based on raange input)
     * @param {String} p_Key 
     * @param {Number} p_Value 
     */
    setUpdateProperty(p_Key, p_Value = null)
    {
        let prop = this.m_Props[p_Key];

        if(prop)
        {
            if(p_Value != null)
                prop.value = p_Value;

            if(!prop.shaderLoc)
            {
                prop.shaderLoc = gl.getUniformLocation(
                    GlContext.Programs.MAIN, 
                    `u_${p_Key}[${this.m_Id}]`
                );
            }

            switch(typeof(prop.value))
            {
                case "number":
                    {
                        if(
                            Number.isInteger(prop.value)
                            && Number.isInteger(prop.transform)
                        )
                        {// Integer
                            gl.uniform1i(
                                prop.shaderLoc,
                                parseInt(prop.value * prop.transform)
                            );
                        }
                        else
                        {// Float
                            gl.uniform1f(
                                prop.shaderLoc,
                                parseFloat(prop.value * prop.transform)
                            );
                        }
                        break;
                    }
                default:
                    {
                        console.warn(`Unsupported property data type: ${typeof(prop.value)} ${prop.value}`);
                    }
            }
            Utils.setLabelValue(`value_text_${p_Key}`, prop.value * prop.transform);
        }
        else
        {
            console.error(`Property ${p_Key} does not exist!`);
        }
    }

    /**
     * @biref - Enabled or disabled layer to be rendered
     * @param {Boolean} p_Val - Enabled/disabled flag
     */
    enableDisableLayer(p_Val = null)
    {
        this.m_Enabled = (p_Val != null) ? p_Val : !this.m_Enabled;
        if(!this.m_Props.Enabled.shaderLoc)
        {
            this.m_Props.Enabled.shaderLoc = gl.getUniformLocation(
                GlContext.Programs.MAIN, 
                `u_LayerEnabled[${this.m_Id}]`
            );
        }

        gl.uniform1i(
            this.m_Props.Enabled.shaderLoc,
            (this.m_Enabled) ? 1 : 0
        );

        Utils.render();
    }

    /**
     * @bried - Sets flags (image adjust. props. - use/don't use) into the shader
     */
    setEffectFlags()
    {
        gl.uniform4iv(
            this.m_ShaderLoc.BrCoGaSa,
            new Int8Array([
                this.m_Props.Brightness.enabled ? 1 : 0,
                this.m_Props.Contrast.enabled ? 1 : 0,
                this.m_Props.Gamma.enabled ? 1 : 0,
                this.m_Props.Saturation.enabled ? 1 : 0
            ])
        );

        gl.uniform2iv(
            this.m_ShaderLoc.HuGa,
            new Int8Array([
                this.m_Props.Hue.enabled ? 1 : 0,
                this.m_Props.GaussBlurRadius.enabled ? 1 : 0
            ])
        );
    }

    /**
     * @brief - Sets blend mode for the layer and updates shader uniform
     * @param {Integer} p_Mode 
     */
    setBlendMode(p_Mode)
    {
        this.m_Props.BlendMode.value = p_Mode;

        if(!this.m_Props.BlendMode.shaderLoc)
        {
            this.m_Props.BlendMode.shaderLoc = gl.getUniformLocation(
                GlContext.Programs.MAIN, 
                `u_BlendMode[${this.m_Id}]`
            );
        }

        gl.uniform1i(
            this.m_Props.BlendMode.shaderLoc,
            this.m_Props.BlendMode.value
        );

        Utils.render();
    }
};