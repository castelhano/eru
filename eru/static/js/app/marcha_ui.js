class MarchaUI{
    constructor(options){
        this.rulerNumColor = options?.rulerNumColor || '#888';
        this.rulerNumSize = options?.rulerNumSize || '10px';
        this.rulerNumPaddingStart = options?.rulerNumPaddingStart || '0.75ch';
        this.rulerUnit = options?.rulerUnit || 1;
        this.rulerSmallWidth = options?.rulerSmallWidth || '1px';
        this.rulerSmallColor = options?.rulerSmallColor || '#666';
        this.rulerSmallHeight = options?.rulerSmallHeight || '8px';
        this.rulerSmallUnit = options?.rulerSmallUnit || 10;
        this.rulerMediumWidth = options?.rulerMediumWidth || '1px';
        this.rulerMediumColor = options?.rulerMediumColor || '#BBB';
        this.rulerMediumHeight = options?.rulerMediumHeight || '15px';
        this.rulerMediumUnit = options?.rulerMediumUnit || 60;

        // this.translateMetrics = {
        // document.body.style.setProperty('--ruler-num-fz';
        // document.body.style.setProperty('--ruler-num-pi';
        // document.body.style.setProperty('--ruler-unit';
        // document.body.style.setProperty('--ruler1-bdw';
        // document.body.style.setProperty('--ruler1-c';
        // document.body.style.setProperty('--ruler1-h';
        // document.body.style.setProperty('--ruler1-space';
        // document.body.style.setProperty('--ruler2-bdw';
        // document.body.style.setProperty('--ruler2-c';
        // document.body.style.setProperty('--ruler2-h';
        // document.body.style.setProperty('--ruler2-space';
        // }


    }
    __updateMetrics(prop, value){
        document.body.style.setProperty(prop, value);
        document.body.style.setProperty('--ruler-num-fz', this.rulerNumSize);
        document.body.style.setProperty('--ruler-num-pi', this.rulerNumPaddingStart);
        document.body.style.setProperty('--ruler-unit', this.rulerUnit);
        document.body.style.setProperty('--ruler1-bdw', this.rulerSmallWidth);
        document.body.style.setProperty('--ruler1-c',  this.rulerSmallColor);
        document.body.style.setProperty('--ruler1-h', this.rulerSmallHeight);
        document.body.style.setProperty('--ruler1-space', this.rulerSmallUnit);
        document.body.style.setProperty('--ruler2-bdw', this.rulerMediumWidth);
        document.body.style.setProperty('--ruler2-c',  this.rulerMediumColor);
        document.body.style.setProperty('--ruler2-h', this.rulerMediumWidth);
        document.body.style.setProperty('--ruler2-space', this.rulerMediumUnit);
    }
}