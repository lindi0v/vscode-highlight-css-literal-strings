/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
const size = '14px';
const red = '#ff0000';

// TS syntax highlight still works
class A {
  private prop: number = 1;

  constructor() {}

  someMethod(): void {}
}

const yourFancyStyle = /* css */ `
.some {
  #id {
    background: transparent;
    color: ${red};
  }
}

body {
  background: #fff;
  font-size: ${size ?? '16px'};
  box-shadow: 0 0 0 3px;
  border-radius: 20px;
  display: flex;
  box-sizing: border-box;

  // just a random complex selector
  [data-some="123"] + abbr ~ div::first-child {
    width: 100px;
  }

  border-radius: 100rem;
}

html,
body {
  line-height: inherit;
}
`;

// other styles works too
/* css */ `
.some {
  backdrop-filter: blur(10px);
  margin: 10px;

  .inner {
    width: 100px;
  }
}
`;
