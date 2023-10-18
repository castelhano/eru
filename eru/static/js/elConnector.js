
class jsELConnector{
    constructor(options){
        if(!options.from || !options.to){return false}
        this.from = options.from;
        this.to = options.to;
        this.container = options?.container || document.body;
        this.fromIcon = [undefined].includes(options.fromIcon) ? '<i class="bi bi-circle-fill" style="font-size: 0.6rem;"></i>' : options.fromIcon;
        this.toIcon = options?.toIcon || '<i class="bi bi-chevron-right fs-5"></i>';

        // Estilizacao
        this.style = options?.style || 'linear';
        this.fromGap = options?.fromGap || 5;
        this.toGap = options?.toGap || 10;
        this.breakpoint = options?.breakpoint || 0.2; // Percentual da distancia entre os dois elementos onde a linha vai descer
        this.lineH = options?.lineH || '2px';
        this.lineC = options?.lineC || 'var(--bs-body-color)';

        this.build();
    }
    build(){
        let fromS = this.from.offsetLeft;
        let fromT = this.from.offsetTop;
        let fromW = this.from.offsetWidth;
        let fromH = this.from.offsetHeight;
        let fromE = this.from.offsetLeft + this.from.offsetWidth;
        
        let toS = this.to.offsetLeft;
        let toT = this.to.offsetTop;
        let toW = this.to.offsetWidth;
        let toH = this.to.offsetHeight;
        let toE = this.to.offsetLeft + this.to.offsetWidth;

        let deltaX = toS - fromE;
        if(this.style == 'linear'){
            let rotate = 0;
            let radius = 0;
            let line = document.createElement('div'); line.style.height = this.lineH;line.style.position = 'absolute';line.style.backgroundColor = this.lineC;line.style.zIndex = '90';
            line.style.top = `${fromT + (fromH / 2) + (deltaX - this.fromGap - this.toGap) * (rotate / 100) + radius}px`;
            line.style.left = `${fromE + this.fromGap}px`;
            line.style.width = `${deltaX - this.fromGap - this.toGap}px`;
            line.style.transform = `skewY(${rotate}deg)`
            
            this.container.appendChild(line);
        }
        else if(this.style == 'path'){
            
            let deltaY = (toT + (toH / 2) - (parseInt(this.lineH) / 2)) - (fromT + (fromH / 2) - (parseInt(this.lineH) / 2));
            
            let initial = document.createElement('div'); initial.style.height = this.lineH;initial.style.position = 'absolute';initial.style.backgroundColor = this.lineC;initial.style.zIndex = '90';
            initial.style.top = `${fromT + (fromH / 2) - (parseInt(this.lineH) / 2)}px`;
            initial.style.left = `${fromE + this.fromGap}px`;
            initial.style.width = `${deltaX * this.breakpoint}px`;
            if(this.fromIcon && this.fromIcon != ''){
                this.startIcon = document.createElement('span');this.startIcon.style.position = 'absolute';this.startIcon.innerHTML = this.fromIcon;this.startIcon.style.zIndex = '100';
                this.startIcon.style.top = `${fromT + (fromH / 2) - (parseInt(this.lineH) / 2) - 14}px`;
                this.startIcon.style.left = `${fromE + this.fromGap}px`;
                this.container.appendChild(this.startIcon);
            }
            
            let final = document.createElement('div'); final.style.height = this.lineH;final.style.position = 'absolute';final.style.backgroundColor = this.lineC;final.style.zIndex = '90';
            final.style.top = `${toT + (toH / 2) - (parseInt(this.lineH) / 2)}px`;
            final.style.left = `${fromE + this.fromGap + (deltaX * this.breakpoint)}px`;
            final.style.width = `${deltaX * (1 - this.breakpoint) - (this.fromGap + this.toGap)}px`;
            if(this.toIcon &&  this.toIcon != ''){
                this.endIcon = document.createElement('span');this.endIcon.style.position = 'absolute';this.endIcon.innerHTML = this.toIcon;this.endIcon.style.zIndex = '100';
                this.endIcon.style.top = `${toT + (toH / 2) - (parseInt(this.lineH) / 2) - 15}px`;
                this.endIcon.style.left = `${toS - this.toGap - 14}px`;
                this.container.appendChild(this.endIcon);
            }
            
            let central = document.createElement('div'); central.style.width = this.lineH;central.style.position = 'absolute';central.style.backgroundColor = this.lineC;central.style.zIndex = '90';
            central.style.top = `${fromT + (fromH / 2) - (parseInt(this.lineH) / 2)}px`;
            central.style.left = `${deltaX * this.breakpoint + fromE + this.fromGap}px`;
            central.style.height = `${deltaY}px`;
            
            this.container.appendChild(initial);
            this.container.appendChild(final);
            this.container.appendChild(central);
        }
    }
}