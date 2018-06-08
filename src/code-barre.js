import * as React from "react";

export default class CodeBarreHtml5 extends React.Component {
  constructor(props) {
    super(props);
    this.init = this.init.bind(this);
    this.setHandler = this.setHandler.bind(this);
    this.snapshot = this.snapshot.bind(this);
    this.processImage = this.processImage.bind(this);
    this.analyze = this.analyze.bind(this);
    this.normalize = this.normalize.bind(this);
    this.isOdd = this.isOdd.bind(this);
    this.maxDistance = this.maxDistance.bind(this);
    this.parity = this.parity.bind(this);
    this.drawGraphics = this.drawGraphics.bind(this);
    this.drawBars = this.drawBars.bind(this);
    this.state = { result: "" };
  }
  localMediaStream = null;
  bars = [];
  handler = null;

  dimensions = {
    height: 0,
    width: 0,
    start: 0,
    end: 0
  };

  elements = {
    video: null,
    canvas: null,
    ctx: null,
    canvasg: null,
    ctxg: null
  };

  upc = {
    "0": [3, 2, 1, 1],
    "1": [2, 2, 2, 1],
    "2": [2, 1, 2, 2],
    "3": [1, 4, 1, 1],
    "4": [1, 1, 3, 2],
    "5": [1, 2, 3, 1],
    "6": [1, 1, 1, 4],
    "7": [1, 3, 1, 2],
    "8": [1, 2, 1, 3],
    "9": [3, 1, 1, 2]
  };

  check = {
    oooooo: "0",
    ooeoee: "1",
    ooeeoe: "2",
    ooeeeo: "3",
    oeooee: "4",
    oeeooe: "5",
    oeeeoo: "6",
    oeoeoe: "7",
    oeoeeo: "8",
    oeeoeo: "9"
  };

  config = {
    strokeColor: "#f00",
    start: 0.1,
    end: 0.9,
    threshold: 160,
    quality: 0.45,
    delay: 100,
    video: "",
    canvas: "",
    canvasg: ""
  };

  componentDidMount() {
    this.elements.video = document.querySelector(this.config.video);
    this.elements.canvas = document.querySelector(this.config.canvas);
    this.elements.ctx = this.elements.canvas.getContext("2d");
    this.elements.canvasg = document.querySelector(this.config.canvasg);
    this.elements.ctxg = this.elements.canvasg.getContext("2d");

    this.setHandler(function(barcode) {
      document.getElementById("result").html(barcode);
    });
    this.init();
  }

  init() {
    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (navigator.getUserMedia) {
      navigator.getUserMedia(
        { audio: false, video: true },
        stream => {
          this.elements.video.src = window.URL.createObjectURL(stream);
        },
        error => console.log(error)
      );
    }

    this.elements.video.addEventListener(
      "canplay",
      () => {
        this.dimensions.height = this.elements.video.videoHeight;
        this.dimensions.width = this.elements.video.videoWidth;

        this.dimensions.start = this.dimensions.width * this.config.start;
        this.dimensions.end = this.dimensions.width * this.config.end;

        this.elements.canvas.width = this.dimensions.width;
        this.elements.canvas.height = this.dimensions.height;
        this.elements.canvasg.width = this.dimensions.width;
        this.elements.canvasg.height = this.dimensions.height;

        this.drawGraphics();
        setInterval(() => this.snapshot(), this.config.delay);
      },
      false
    );
  }

  snapshot() {
    this.elements.ctx.drawImage(
      this.elements.video,
      0,
      0,
      this.dimensions.width,
      this.dimensions.height
    );
    this.processImage();
  }

  processImage() {
    this.bars = [];

    var pixels = [];
    var binary = [];
    var pixelBars = [];

    // convert to grayscale

    var imgd = this.elements.ctx.getImageData(
      this.dimensions.start,
      this.dimensions.height * 0.5,
      this.dimensions.end - this.dimensions.start,
      1
    );
    var rgbpixels = imgd.data;

    for (var i = 0, ii = rgbpixels.length; i < ii; i = i + 4) {
      pixels.push(
        Math.round(
          rgbpixels[i] * 0.2126 +
            rgbpixels[i + 1] * 0.7152 +
            rgbpixels[i + 2] * 0.0722
        )
      );
    }

    // normalize and convert to binary

    var min = Math.min.apply(null, pixels);
    var max = Math.max.apply(null, pixels);

    for (let i = 0, ii = pixels.length; i < ii; i++) {
      if (
        Math.round(((pixels[i] - min) / (max - min)) * 255) >
        this.config.threshold
      ) {
        binary.push(1);
      } else {
        binary.push(0);
      }
    }

    // determine bar widths

    var current = binary[0];
    var count = 0;

    for (let i = 0, ii = binary.length; i < ii; i++) {
      if (binary[i] === current) {
        count++;
      } else {
        pixelBars.push(count);
        count = 1;
        current = binary[i];
      }
    }
    pixelBars.push(count);

    // quality check

    if (pixelBars.length < 3 + 24 + 5 + 24 + 3 + 1) {
      return;
    }

    // find starting sequence

    var startIndex = 0;
    var minFactor = 0.5;
    var maxFactor = 1.5;

    for (let i = 3, ii = pixelBars.length; i < ii; i++) {
      var refLength = (pixelBars[i] + pixelBars[i - 1] + pixelBars[i - 2]) / 3;
      if (
        (pixelBars[i] > minFactor * refLength ||
          pixelBars[i] < maxFactor * refLength) &&
        (pixelBars[i - 1] > minFactor * refLength ||
          pixelBars[i - 1] < maxFactor * refLength) &&
        (pixelBars[i - 2] > minFactor * refLength ||
          pixelBars[i - 2] < maxFactor * refLength) &&
        pixelBars[i - 3] > 3 * refLength
      ) {
        startIndex = i - 2;
        break;
      }
    }

    console.log("startIndex: " + startIndex);

    // return if no starting sequence found

    if (startIndex === 0) {
      return;
    }

    // discard leading and trailing patterns

    pixelBars = pixelBars.slice(startIndex, startIndex + 3 + 24 + 5 + 24 + 3);

    console.log("pixelBars: " + pixelBars);

    // calculate relative widths

    var ref = (pixelBars[0] + pixelBars[1] + pixelBars[2]) / 3;

    for (let i = 0, ii = pixelBars.length; i < ii; i++) {
      this.bars.push(Math.round((pixelBars[i] / ref) * 100) / 100);
    }

    // analyze pattern

    this.analyze();
  }

  analyze() {
    console.clear();

    console.log("analyzing");

    // determine parity first digit and reverse sequence if necessary

    var first = this.normalize(this.bars.slice(3, 3 + 4), 7);
    if (!this.isOdd(Math.round(first[1] + first[3]))) {
      this.bars = this.bars.reverse();
    }

    // split into digits

    var digits = [
      this.normalize(this.bars.slice(3, 3 + 4), 7),
      this.normalize(this.bars.slice(7, 7 + 4), 7),
      this.normalize(this.bars.slice(11, 11 + 4), 7),
      this.normalize(this.bars.slice(15, 15 + 4), 7),
      this.normalize(this.bars.slice(19, 19 + 4), 7),
      this.normalize(this.bars.slice(23, 23 + 4), 7),
      this.normalize(this.bars.slice(32, 32 + 4), 7),
      this.normalize(this.bars.slice(36, 36 + 4), 7),
      this.normalize(this.bars.slice(40, 40 + 4), 7),
      this.normalize(this.bars.slice(44, 44 + 4), 7),
      this.normalize(this.bars.slice(48, 48 + 4), 7),
      this.normalize(this.bars.slice(52, 52 + 4), 7)
    ];

    console.log("digits: " + digits);

    // determine parity and reverse if necessary

    var parities = [];

    for (let i = 0; i < 6; i++) {
      if (this.parity(digits[i])) {
        parities.push("o");
      } else {
        parities.push("e");
        digits[i] = digits[i].reverse();
      }
    }

    // identify digits

    var result = [];
    var quality = 0;

    for (let i = 0, ii = digits.length; i < ii; i++) {
      var distance = 9;
      var bestKey = "";

      for (this.key in this.upc) {
        if (this.maxDistance(digits[i], this.upc[this.key]) < distance) {
          distance = this.maxDistance(digits[i], this.upc[this.key]);
          bestKey = this.key;
        }
      }

      result.push(bestKey);
      if (distance > quality) {
        quality = distance;
      }
    }

    console.log("result: " + result);

    // check digit

    var checkDigit = this.check[parities.join("")];

    // output

    console.log("quality: " + quality);

    if (quality < this.config.quality) {
      if (this.handler != null) {
        this.handler(checkDigit + result.join(""));
        this.setState({ result: checkDigit + result.join("") });
      }
    }
  }

  setHandler(h) {
    this.handler = h;
  }

  normalize(input, total) {
    var sum = 0;
    var result = [];
    for (let i = 0, ii = input.length; i < ii; i++) {
      sum = sum + input[i];
    }
    for (let i = 0, ii = input.length; i < ii; i++) {
      result.push((input[i] / sum) * total);
    }
    return result;
  }

  isOdd(num) {
    return num % 2;
  }

  maxDistance(a, b) {
    var distance = 0;
    for (let i = 0, ii = a.length; i < ii; i++) {
      if (Math.abs(a[i] - b[i]) > distance) {
        distance = Math.abs(a[i] - b[i]);
      }
    }
    return distance;
  }

  parity(digit) {
    return this.isOdd(Math.round(digit[1] + digit[3]));
  }

  drawGraphics() {
    this.elements.ctxg.strokeStyle = this.config.strokeColor;
    this.elements.ctxg.lineWidth = 3;
    this.elements.ctxg.beginPath();
    this.elements.ctxg.moveTo(
      this.dimensions.start,
      this.dimensions.height * 0.5
    );
    this.elements.ctxg.lineTo(
      this.dimensions.end,
      this.dimensions.height * 0.5
    );
    this.elements.ctxg.stroke();
  }

  // debugging utilities
  drawBars(binary) {
    for (var i = 0, ii = binary.length; i < ii; i++) {
      if (binary[i] === 1) {
        this.elements.ctxg.strokeStyle = "#fff";
      } else {
        this.elements.ctxg.strokeStyle = "#000";
      }
      this.elements.ctxg.lineWidth = 3;
      this.elements.ctxg.beginPath();
      this.elements.ctxg.moveTo(this.start + i, this.height * 0.5);
      this.elements.ctxg.lineTo(this.start + i + 1, this.height * 0.5);
      this.elements.ctxg.stroke();
    }
  }

  render() {
    this.config.start = 0.1;
    this.config.end = 0.9;
    this.config.video = "#barcodevideo";
    this.config.canvas = "#barcodecanvas";
    this.config.canvasg = "#barcodecanvasg";

    return (
      <React.Fragment>
        <div id="barcode">
          <video id="barcodevideo" autoplay />
          <canvas id="barcodecanvasg" />
        </div>
        <canvas id="barcodecanvas" />
        <div id="result" />
        <div>{this.state.result}</div>
      </React.Fragment>
    );
  }
}
