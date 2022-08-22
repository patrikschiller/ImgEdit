import { Utils } from "./Utils.js";
import ImageLayer from "./ImageLayer.js";

export default class ImageContext
{
    /**
     * @var {ImageLayer} m_Layers
     */
    m_Layers = []; 
    m_ActiveLayer = 0;
    m_ImgAspectRatio = 1.0;

    /**
     * @brief - Creates new ImageLayer, appends to the ImageLayer list
     * @param {WebGLTexture} p_Texture 
     * @param {String} p_Label 
     * @returns {Integer} Id of currently created layer
     */
    loadImageLayer(p_Texture, p_Label = "")
    {
        this.m_Layers.push(
            new ImageLayer(p_Texture, this.m_Layers.length, (p_Label != "") ? p_Label : `Layer${this.m_Layers.length}`)
        );
        document.getElementById("layers_display_label").innerHTML = `Layers ${this.m_Layers.length}/${DEFINE_MAX_LAYERS}`
        return this.m_Layers.length - 1;
    }

    /**
     * @brief - Returns layer with given ID (when no ID is supplied, current layer is returend)
     * @param {Integer} p_Id 
     * @returns {ImageLayer}
     */
    getImageLayer(p_Id = null)
    {
        return this.m_Layers[(p_Id) ? p_Id : this.m_ActiveLayer];
    }

    /**
     * @brief - Completely deletes given layer (together with texture)
     * @param {Integer} p_Id 
     */
    deleteImageLayer(p_Id)
    {
        gl.deleteTexture(this.m_Layers[p_Id].m_Texture);
        this.m_Layers.splice(p_Id, 1);
        const el = document.querySelector(`#layers_display :nth-child(${p_Id+1})`)
        el.remove();
        console.log(`Layer ${p_Id} deleted`);
    }

    /**
     * @brief - Sets given layer as active (actions performed will affect active layer)
     * @param {Integer} p_LayerId 
     */
    setActiveLayer(p_LayerId)
    {
        this.m_ActiveLayer = p_LayerId;

        // Update form values according to active layer
        const Layer = this.getImageLayer();
        
        Object.entries(Layer.m_Props).forEach((prop) => {
            if(prop[0] != 'Enabled' && prop[0] != 'BlendMode')
            {
                // Set Value
                const propSlider = document.getElementById(`range_${prop[0]}`);
                propSlider.value = prop[1].value;
                Utils.setLabelValue(`value_text_${prop[0]}`, prop[1].value * prop[1].transform);

                // Set flag
                const propCheck = document.getElementById(`check_${prop[0]}`);
                propCheck.checked = (prop[1].enabled) ? "checked" : "";
            }
        });
    }
}
