require("dotenv").config();

// ===== API-шки для сторонних сервисов =====
class API {
  constructor () {
    this.api_key = process.env.RAPIDAPI_KEY
  }

  static setApi() {
    return new API();
  }
}

const api = API.setApi();


module.exports = api;