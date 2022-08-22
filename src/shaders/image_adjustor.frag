// For Fragment Shaders, version and precision definition must be commented out 
//  - they are injected by JS in shader compilation process
/*#version 100
precision mediump float;*/

// If not supplied by JS...
#ifndef MAX_LAYERS
    #define MAX_LAYERS 4
#endif
#ifndef GAUSS_BLUR_MAX_RADIUS
    #define GAUSS_BLUR_MAX_RADIUS 5
#endif
#ifndef CHECKER_TILE_WIDTH
    #define CHECKER_TILE_WIDTH 15
#endif

uniform sampler2D u_Image[MAX_LAYERS];

uniform float   u_Brightness[MAX_LAYERS];
uniform float   u_Contrast[MAX_LAYERS];
uniform float   u_Gamma[MAX_LAYERS];
uniform float   u_Saturation[MAX_LAYERS];
uniform float   u_Hue[MAX_LAYERS];
uniform int     u_GaussBlurRadius[MAX_LAYERS];

uniform ivec4   u_Flag_BrCoGaSa[MAX_LAYERS];
uniform ivec2   u_Flag_HuGa[MAX_LAYERS];

// In WebGL 2, gl_FragCoord + texelFetch would be used instead..
uniform vec2    u_VpImgRes;

uniform int     u_ActiveLayer;
uniform int     u_LayersLoaded;
uniform int     u_LayerEnabled[MAX_LAYERS];
uniform int     u_BlendMode[MAX_LAYERS];

varying vec2 v_UV;

#line 37
/**
    Classic single-pass 2D Gauss blur (not separable 2-pass blur)
    - inspired by: https://stackoverflow.com/questions/64837705/opengl-blurring
    - kernel values could be precomputed on host, or hardcoded to improve performance
*/
vec3 GaussBlur2D(in sampler2D p_Layer, in int p_GaussRadius)
{
    vec2 UV;
    float kerDeltaX, kerDeltaY, xx, yy, w;
    vec3 blurredColor = vec3(0.0);

    // Pixel U,V delta, could be pre-computed on Host
    float g_PixStepX    = 1.0 / u_VpImgRes.x;
    float g_PixStepY    = 1.0 / u_VpImgRes.y;  
    float rr            = float(p_GaussRadius * p_GaussRadius);
    float w0            = 0.3780/pow(float(p_GaussRadius),1.975);
    int kerSize         = p_GaussRadius* 2 + 1;  

    // GLSL 1.0 does not allow dynamic for-loops, num iterations must be known in compilation time
    for(int i = 0; i < 2 * GAUSS_BLUR_MAX_RADIUS + 1; i++)
    {
        if(i >= kerSize)
            break;

        kerDeltaX = float(i - p_GaussRadius); 
        UV.s = clamp(v_UV.s + kerDeltaX * g_PixStepX, 0.0, 1.0);

        for(int j = 0; j < 2 * GAUSS_BLUR_MAX_RADIUS + 1; j++)
        {
            if(j >= kerSize)
                break;

            kerDeltaY = float(j - p_GaussRadius); 

            xx = kerDeltaX * kerDeltaX;
            yy = kerDeltaY * kerDeltaY;
            
            if (xx+yy<=rr)
            {
                w = w0 * exp((-xx-yy)/(2.0*rr));
                UV.t = clamp(v_UV.t + kerDeltaY * g_PixStepY, 0.0, 1.0);
                vec4 texColor = texture2D(p_Layer, UV);
                blurredColor += texColor.rgb * texColor.a * w;
            }
        }
    }

    // For radius 1 the result is brighter than input --> fixed by 0.75 multiplication
    return (p_GaussRadius == 1) ? blurredColor.rgb * 0.75 : blurredColor;
}

// https://www.pocketmagic.net/enhance-saturation-in-images-programatically/
vec3 HSL_2_RGB(in vec3 p_HslVal)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(p_HslVal.xxx + K.xyz) * 6.0 - K.www);
    return p_HslVal.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), p_HslVal.y);
}

// https://www.pocketmagic.net/enhance-saturation-in-images-programatically/
vec3 RGB_2_HSL(in vec3 p_RgbVal)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(p_RgbVal.bg, K.wz), vec4(p_RgbVal.gb, K.xy), step(p_RgbVal.b, p_RgbVal.g));
    vec4 q = mix(vec4(p.xyw, p_RgbVal.r), vec4(p_RgbVal.r, p.yzx), step(p.x, p_RgbVal.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// [!] https://gamedev.stackexchange.com/questions/59797/glsl-shader-change-hue-saturation-brightness
// https://www.pocketmagic.net/enhance-saturation-in-images-programatically/
vec3 adjustHueSaturation(in vec3 p_Color, in float p_Hue, in float p_Sat)
{
    // Convert to HSL
    vec3 HSL = RGB_2_HSL(p_Color);

    // Adjust hue
    if(p_Hue != -11111.0)
        HSL.x *= p_Hue;

    // Adjust saturation
    if(p_Sat != -11111.0)
        HSL.y *= p_Sat;

    // Convert back to RGB
    return HSL_2_RGB(HSL);
}

void main()
{
    vec4 finalColor = vec4(0.0, 0.0, 0.0, 0.0);

    for(int i = 0; i < MAX_LAYERS; i++)
    {
        if(i >= u_LayersLoaded)
            break;

        if(u_LayerEnabled[i] == 1)
        {
            // Get image layer base color
            vec4 inColor = (u_Flag_HuGa[i].y == 1 && u_GaussBlurRadius[i] > 0)
                ? vec4(
                    GaussBlur2D(u_Image[i], u_GaussBlurRadius[i]),
                    texture2D(u_Image[i], v_UV).a
                )
                : texture2D(u_Image[i], v_UV);

            vec3 layerColor = inColor.rgb;

            // Apply contrast
            if(u_Flag_BrCoGaSa[i].y == 1)
                layerColor *= u_Contrast[i];

            // Apply Gamma
            if(u_Flag_BrCoGaSa[i].z == 1)
                layerColor = vec3(
                    pow(layerColor.r, u_Gamma[i]),
                    pow(layerColor.g, u_Gamma[i]),
                    pow(layerColor.b, u_Gamma[i])
                );

            // Adjust hue & saturation
            if(u_Flag_BrCoGaSa[i].w == 1 || u_Flag_HuGa[i].x == 1)
                layerColor = adjustHueSaturation(
                    layerColor, 
                    (u_Flag_HuGa[i].y == 1) ? u_Hue[i] : -11111.0, 
                    (u_Flag_BrCoGaSa[i].w == 1) ? u_Saturation[i] : -11111.0
                );  

            // Apply brightness
            if(u_Flag_BrCoGaSa[i].x == 1)
                layerColor += vec3(u_Brightness[i]);

        // --== Blending ==--
            if(i >= 1)
            {
                // Switch not supprtoedd in GLSL 1.0
                if(u_BlendMode[i] == 0)
                { // Normal
                    //finalColor = mix(finalColor, layerColor, inColor.a);

                    // Improved normal blending (alpha channel is also affected):
                    // https://en.wikipedia.org/wiki/Alpha_compositing
                    float a0 = mix(finalColor.a, 1.0, inColor.a);
                    vec3 c0 = mix(finalColor.rgb * finalColor.a , layerColor, inColor.a);

                    finalColor = vec4(c0, a0);
                }
                else if(u_BlendMode[i] == 1)
                { // Screen
                    //finalColor = vec3(1.0) - (vec3(1.0) - finalColor) * (vec3(1.0) - layerColor);

                    finalColor = vec4(1.0) - (vec4(1.0) - finalColor) * (vec4(1.0) - vec4(layerColor, inColor.a));
                }
                else if(u_BlendMode[i] == 2)
                { // Multiply
                    finalColor = vec4(layerColor * finalColor.rgb, inColor.a * finalColor.a);
                }
                else
                { // Default, no blending mode
                    finalColor = vec4(layerColor, inColor.a);
                }
            }
            else
            { // Base layer, blending with checker
                finalColor = vec4(layerColor, inColor.a);
            }   
        }
    }  

    // Blend the final image with background checker-board (when semi-transparent)
    if(finalColor.a < 1.0 && u_LayersLoaded > 0)
    {
        float pixStepX  = 1.0 / u_VpImgRes.x;
        float pixStepY  = 1.0 / u_VpImgRes.y;
        float tileX     = floor(v_UV.s / (pixStepX * float(CHECKER_TILE_WIDTH)));
        float tileY     = floor(v_UV.t / (pixStepY * float(CHECKER_TILE_WIDTH)));

        bool tX = (mod(tileX, 2.0) == 0.0);
        bool tY = (mod(tileY, 2.0) == 0.0);
        if(tX == tY)
        {
            finalColor = vec4(mix(vec3(1.0, 1.0, 1.0), finalColor.rgb, finalColor.a), 1.0);
        }
        else
        {
            finalColor = vec4(mix(vec3(0.9, 0.9, 0.9), finalColor.rgb, finalColor.a), 1.0);
        }
    }

    // Clamp rgb values
    finalColor = vec4(clamp(finalColor.rgb, vec3(0.0), vec3(1.0)), 1.0);  

    // Return final color
    gl_FragColor = finalColor;
    //gl_FragColor = vec4(v_UV, 0.0, 1.0);
}