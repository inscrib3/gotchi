import { run } from './inscrib3';

document.getElementById('run')!.addEventListener('click', () => {
    const address = <HTMLInputElement>document.getElementById('taproot_address')!;
    const code = <HTMLInputElement>document.getElementById('code')!;

    run({
        log: (message: string) => {
            const log = document.getElementById('log')!;
            log.innerHTML = message + '<br>';
        },
        address: address.value.trim(),
        tippingAddress: 'bc1psupdj48keuw4s2zwmf456h8l2zvh66kcj858rdunvf0490ldj2uqskmta4',
        text: code.value.trim(),
        mimetype: 'image/svg+xml;charset=utf-8',
    });
});

const shadow = (color: string, amount: number) => {
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + amount));
    g = Math.min(255, Math.max(0, g + amount));
    b = Math.min(255, Math.max(0, b + amount));
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  };

  const colorClickListener = (element: HTMLElement, input: HTMLInputElement) => {
    element.addEventListener('click', () => {
      input.click();
    });
  };

  const getCode = () => {
    const code = document.getElementById('code')!;
    const svgContainer = document.getElementById('svg-container')!;
    code.innerHTML = svgContainer.innerHTML.replace('<script>\n//\n', '<script><![CDATA[ ').replace('\n//\n</script>', ' ]]></script>');
  }

  const base = document.getElementById('base')!;
  const darkShadow = document.getElementById('base-dark-shadow')!;
  const lightShadow = document.getElementById('base-light-shadow')!;
  const baseColor = document.getElementById('base-color')!;
  const baseColorInput = <HTMLInputElement>document.getElementById('base-color-input')!;

  const rightButton = document.getElementById('right-button')!;
  const leftButton = document.getElementById('left-button')!;
  const centerButton = document.getElementById('center-button')!;
  const rightButtonShadow = document.getElementById('right-button-shadow')!;
  const leftButtonShadow = document.getElementById('left-button-shadow')!;
  const centerButtonShadow = document.getElementById('center-button-shadow')!;
  const buttonsColor = document.getElementById('buttons-color')!;
  const buttonsColorInput = <HTMLInputElement>document.getElementById('buttons-color-input')!;

  const frameColor = document.getElementById('frame-color')!;
  const frame = document.getElementById('frame')!;
  const frameShadow = document.getElementById('frame-shadow')!;
  const frameColorInput = <HTMLInputElement>document.getElementById('frame-color-input')!;

  const backgroundColor = document.getElementById('background-color')!;
  const backgroundColorInput = <HTMLInputElement>document.getElementById('background-color-input')!;

  const ordinalsInput = <HTMLInputElement>document.getElementById('ordinals-input')!;
  const ordinals = document.getElementById('ordinals')!;

  colorClickListener(baseColor, baseColorInput);
  colorClickListener(buttonsColor, buttonsColorInput);
  colorClickListener(frameColor, frameColorInput);
  colorClickListener(backgroundColor, backgroundColorInput);

  getCode();

  baseColorInput.addEventListener('input', () => {
    base.setAttribute('fill', baseColorInput.value);
    darkShadow.setAttribute('fill', shadow(baseColorInput.value, -50));
    lightShadow.setAttribute('fill', shadow(baseColorInput.value, 50));
    baseColor.style.backgroundColor = baseColorInput.value;
    getCode();
  });

  buttonsColorInput.addEventListener('input', () => {
    rightButton.setAttribute('fill', buttonsColorInput.value);
    leftButton.setAttribute('fill', buttonsColorInput.value);
    centerButton.setAttribute('fill', buttonsColorInput.value);
    buttonsColor.style.backgroundColor = buttonsColorInput.value;
    rightButtonShadow.setAttribute('fill', shadow(buttonsColorInput.value, 50));
    leftButtonShadow.setAttribute('fill', shadow(buttonsColorInput.value, 50));
    centerButtonShadow.setAttribute('fill', shadow(buttonsColorInput.value, 50));
    getCode();
  });

  frameColorInput.addEventListener('input', () => {
    frame.setAttribute('fill', frameColorInput.value);
    frameShadow.setAttribute('fill', shadow(frameColorInput.value, -50));
    frameColor.style.backgroundColor = frameColorInput.value;
    getCode();
  });

  backgroundColorInput.addEventListener('input', () => {
    document.getElementById('svg')!.style.backgroundColor = backgroundColorInput.value;
    document.body.style.backgroundColor = backgroundColorInput.value;
    backgroundColor.style.backgroundColor = backgroundColorInput.value;
    getCode();
  });

  ordinalsInput.addEventListener('input', () => {
    ordinals.setAttribute('xlink:href', `/content/${ordinalsInput.value}`);
    ordinals.setAttribute('href', `/content/${ordinalsInput.value}`);
    getCode();
  });