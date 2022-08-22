# ImgEdit
Simple GPU accelerated image editor (Work In Progress)
- Implemented using JavaScript ES6+ & WebGL 1.0
- Enables per-layer image (composition) adjustments and layer blending
- http://schillerpatrik.com/imgedit/

## Layers
- each layer can be separately adjusted
- layer blending modes: screen, normal, multiply

## Image adjustments
- contrast
- brightness
- gamma correction
- hue + saturation
- Gaussian blur (single pass 2D convolution)

## ToDo
- Image scaling (currently the scale (aspect ratio) is derived from the last image/layer loaded)
- Variable layers order (layers can be re-ordered by drag&drop in the layers panel)
- Better Gaussian blur methods - separable 2-pass & single pass aproximate GB
- Add new and more complex tools
