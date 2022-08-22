// Shader for 2-pass gauss blur (separable convolution with 1D kernel)
// WIP
//#version 100
precision mediump float;

uniform sampler2D u_Image;

varying vec2 v_UV;

// WIP
void main()
{
    gl_FragColor = texture2D(u_Image, v_UV);
}