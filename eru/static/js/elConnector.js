
class jsELConnector{
    constructor(options){
        if(!options.from || !options.to){return false}
        this.from = options.from;
        this.to = options.to;
        this.container = options?.container || document.body;
        this.els = []; // Armazena elementos inseridos no container        
        
        // Estilizacao
        this.fromIcon = [undefined].includes(options.fromIcon) ? '<i class="bi bi-circle-fill" style="font-size: 0.6rem;"></i>' : options.fromIcon;
        this.toIcon = [undefined].includes(options.toIcon) ? '<i class="bi bi-chevron-right fs-5"></i>' : options.toIcon;
        this.style = options?.style || 'path';
        this.fromGap = options?.fromGap || 5;
        this.toGap = options?.toGap || 5;
        this.breakpoint = options?.breakpoint || 0.2; // Percentual da distancia entre os dois elementos onde a linha vai descer
        this.lineH = options?.lineH || '2px';
        this.lineC = options?.lineC || 'var(--bs-body-color)';

        this.build();
    }
    build(){
        let x1 = this.from.offsetLeft;
        let y1 = this.from.offsetTop;
        let fromW = this.from.offsetWidth;
        let fromH = this.from.offsetHeight;
        let fromE = this.from.offsetLeft + this.from.offsetWidth;

        let x2 = this.to.offsetLeft;
        let y2 = this.to.offsetTop;
        let toW = this.to.offsetWidth;
        let toH = this.to.offsetHeight;
        let toE = this.to.offsetLeft + this.to.offsetWidth;

        let deltaX = (x2 - this.toGap) - (fromE + this.fromGap);
        if(this.style == 'linear'){
            // let gap = (toE - fromE) / 4;
            let gap = 0;
            let rotate = 0;
            // let rotate = (Math.atan(((y2 - toH / 2) - y1) / (x2 - x1 + gap)) * 100);
            let radius = 0;
            let deltaY = ((y2 + toH) - y1) / 2;
            let line = document.createElement('div'); line.style.height = this.lineH;line.style.position = 'absolute';line.style.backgroundColor = this.lineC;line.style.zIndex = '90';
            line.style.top = `${deltaY + y1}px`;
            line.style.left = `${fromE + this.fromGap}px`;
            line.style.width = `${deltaX}px`;
            line.style.transform = `skewY(${rotate}deg)`
            
            this.container.appendChild(line);
            this.els.push(line);
        }
        else if(this.style == 'path'){
            let initial = document.createElement('div'); initial.style.height = this.lineH;initial.style.position = 'absolute';initial.style.backgroundColor = this.lineC;initial.style.zIndex = '90';
            initial.style.top = `${y1 + (fromH / 2) - (parseInt(this.lineH) / 2)}px`;
            initial.style.left = `${fromE + this.fromGap}px`;
            initial.style.width = `${deltaX * this.breakpoint}px`;
            if(this.fromIcon && this.fromIcon != ''){
                this.startIcon = document.createElement('span');this.startIcon.style.position = 'absolute';this.startIcon.innerHTML = this.fromIcon;this.startIcon.style.zIndex = '100';
                this.startIcon.style.top = `${y1 + (fromH / 2) - (parseInt(this.lineH) / 2) - 14}px`;
                this.startIcon.style.left = `${fromE + this.fromGap}px`;
                this.container.appendChild(this.startIcon);
                this.els.push(this.startIcon);
            }
            
            let final = document.createElement('div'); final.style.height = this.lineH;final.style.position = 'absolute';final.style.backgroundColor = this.lineC;final.style.zIndex = '90';
            final.style.top = `${y2 + (toH / 2) - (parseInt(this.lineH) / 2)}px`;
            final.style.left = `${fromE + this.fromGap + (deltaX * this.breakpoint)}px`;
            final.style.width = `${deltaX * (1 - this.breakpoint) - (this.fromGap + this.toGap) - 1}px`;
            if(this.toIcon &&  this.toIcon != ''){
                this.endIcon = document.createElement('span');this.endIcon.style.position = 'absolute';this.endIcon.innerHTML = this.toIcon;this.endIcon.style.zIndex = '100';
                this.endIcon.style.top = `${y2 + (toH / 2) - (parseInt(this.lineH) / 2) - 13.5}px`;
                this.endIcon.style.left = `${x2 - this.toGap - 14}px`;
                this.container.appendChild(this.endIcon);
                this.els.push(this.endIcon);
            }
            
            let central = document.createElement('div'); central.style.width = this.lineH;central.style.position = 'absolute';central.style.backgroundColor = this.lineC;central.style.zIndex = '90';
            let deltaY;
            if(y2 > y1){
                central.style.top = `${y1 + (fromH / 2) - (parseInt(this.lineH) / 2)}px`;
                deltaY = (y2 + (toH / 2) - (parseInt(this.lineH) / 2)) - (y1 + (fromH / 2) - (parseInt(this.lineH) / 2));
            }
            else{
                central.style.top = `${y2 + (toH / 2) - (parseInt(this.lineH) / 2)}px`;
                deltaY = (y1 + (fromH / 2) - (parseInt(this.lineH) / 2)) - (y2 + (toH / 2) - (parseInt(this.lineH) / 2));
                
            }
            central.style.height = `${deltaY}px`;
            central.style.left = `${deltaX * this.breakpoint + fromE + this.fromGap}px`;
            
            this.container.appendChild(initial);
            this.container.appendChild(final);
            this.container.appendChild(central);
            this.els.push(initial);
            this.els.push(final);
            this.els.push(central);
        }
    }
    setVisibility(visibility){
        this.els.forEach((el)=>{el.style.visibility = visibility;})
    }
    destroy(){
        this.els.forEach((el)=> el.remove())
        this.els = [];
        delete this;
    }
}