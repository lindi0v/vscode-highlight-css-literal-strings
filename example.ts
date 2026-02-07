/* eslint-disable @typescript-eslint/no-unused-vars */
const size = '14px';

class A {
  private prop: number = 1;

  constructor() {}
}

const yourFancyStyle = /* css */ `
.some {
  .nested {
    background: inherit;
    
  }
}

#unique {
  color: #ff0000;
}

body {
  background: #fff;
  font-size: ${size ? true : false};
  box-shadow: 0 0 0 3px;
  border-radius: 20px;
  display: flex;
  box-sizing: border-box;

  [data-some="123"] + abbr ~ div::first-child {
    width: 100px;
    width: 100px;
  }

  border-radius: 100px;
}

html,
body {
  box-sizing: border-box;
}
`;

const otherStyle = /* css */ `
.another {
  color: red;
  margin: 10px;

  .another {
    width: 100px;
  }
}
`;
