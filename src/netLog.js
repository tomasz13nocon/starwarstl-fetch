class NetLog {
  redirectNum = 0;
  bytesRecieved = 0;
  imageBytesRecieved = 0;
  requestNum = 0;

  constructor() {
    console.log("new log");
  }

  incRedirect() {
    this.redirectNum++;
  }

  incRequest() {
    this.requestNum++;
  }

  addBytes(bytes) {
    this.bytesRecieved += bytes;
  }

  addImageBytes(bytes) {
    this.imageBytesRecieved += bytes;
  }
}

export default new NetLog();
