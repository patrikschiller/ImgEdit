#version 100
precision mediump float;

#define COLOR_REMAP_FACTOR 0.00390625
#define GAUSS_BLUR_MAX_RADIUS 5

uniform sampler2D u_Image;

uniform float   u_Brightness;
uniform float   u_Contrast;
uniform float   u_Gamma;
uniform float   u_Saturation;
uniform float   u_Hue;
uniform int     u_GaussRadius;

uniform ivec4 u_Flag_BrCoGaSa;
uniform ivec2 u_Flag_HueGauss;

// In WebGL 2, gl_FragCoord + texelFetch would be used instead..
uniform vec2 u_VpImgRes;

varying vec2 v_UV;

/**
    Classic single-pass 2D Gauss blur (not separable 2-pass blur)
    - inspired by: https://stackoverflow.com/questions/64837705/opengl-blurring
    - kernel values could be precomputed on host, or hardcodedd to improve performance
*/
vec3 GaussBlur2D()
{
    vec2 UV;
    float kerDeltaX, kerDeltaY, xx, yy, w;
    vec3 blurredColor = vec3(0.0);

    // Pixel U,V delta, could be pre-computed on Host
    float g_PixStepX    = 1.0 / u_VpImgRes.x;
    float g_PixStepY    = 1.0 / u_VpImgRes.y;  
    float rr            = float(u_GaussRadius * u_GaussRadius);
    float w0            = 0.3780/pow(float(u_GaussRadius),1.975);
    int kerSize         = u_GaussRadius * 2 + 1;  

    // GLSL 1.0 does not allow dynamic for-loops, num iterations must be known in compilation time
    for(int i = 0; i < 2 * GAUSS_BLUR_MAX_RADIUS + 1; i++)
    {
        if(i >= kerSize)
            break;

        kerDeltaX = float(i - u_GaussRadius); 
        UV.x = clamp(v_UV.s + kerDeltaX * g_PixStepX, 0.0, 1.0);

        for(int j = 0; j < 2 * GAUSS_BLUR_MAX_RADIUS + 1; j++)
        {
            if(j >= kerSize)
                break;

            kerDeltaY = float(j - u_GaussRadius); 

            xx = kerDeltaX * kerDeltaX;
            yy = kerDeltaY * kerDeltaY;
            
            if (xx+yy<=rr)
            {
                w = w0 * exp((-xx-yy)/(2.0*rr));
                UV.y = clamp(v_UV.t + kerDeltaY * g_PixStepY, 0.0, 1.0);
                blurredColor += texture2D(u_Image, UV).rgb * w;
            }
        }
    }

    // For radius 1 the result is brighter than input --> fixedd by 0.75 multiplication
    return (u_GaussRadius == 1) ? blurredColor * 0.75 : blurredColor;
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
vec3 adjustHueSaturation(in vec3 p_Color)
{
    // Convert to HSL
    vec3 HSL = RGB_2_HSL(p_Color);

    // Adjust hue
    if(u_Flag_HueGauss.x == 1)
        HSL.x *= u_Hue;

    // Adjust saturation
    if(u_Flag_BrCoGaSa.w == 1)
        HSL.y *= u_Saturation;

    // Convert back to RGB
    return HSL_2_RGB(HSL);
}

void main()
{
    // Get image base color
    vec3 finalColor = (u_Flag_HueGauss.y == 1 && u_GaussRadius > 0)
        ? GaussBlur2D()
        : texture2D(u_Image, v_UV).rgb;

    // Apply contrast
    if(u_Flag_BrCoGaSa.y == 1)
        finalColor *= u_Contrast;

    // Apply Gamma
    if(u_Flag_BrCoGaSa.z == 1)
        finalColor = vec3(
            pow(finalColor.r, u_Gamma),
            pow(finalColor.g, u_Gamma),
            pow(finalColor.b, u_Gamma)
        );

    // Adjust hue + saturation
    if(u_Flag_BrCoGaSa.w == 1 || u_Flag_HueGauss.x == 1)
        finalColor = adjustHueSaturation(finalColor);  

    // Apply brightness
    if(u_Flag_BrCoGaSa.x == 1)
        finalColor += vec3(u_Brightness) * COLOR_REMAP_FACTOR;//(2e-3);

    // Clamp values
    finalColor = clamp(finalColor, vec3(0.0), vec3(1.0));  

    // Return final color
    gl_FragColor = vec4(finalColor, 1.0);
    //gl_FragColor = vec4(v_UV, 0.0, 1.0);
}