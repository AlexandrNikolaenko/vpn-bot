require("dotenv").config();

const crypto = require('crypto');

const BASE_URL = "http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx";

async function loginGetCookie() {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    },
    body: `username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`
  });

  if (!res.ok) throw new Error("Login failed");

  // Получаем Set-Cookie из заголовков
  const rawCookies = res.headers.getSetCookie();
  if (!rawCookies) throw new Error("No cookies returned");

  // Объединяем куки в одну строку
  const cookie = rawCookies.map(c => c.split(";")[0]).join("; ");

  console.log("COOKIE:", cookie);
  return cookie;
}

async function getUUID() {
  // const res = await fetch('http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx/panel/api/server/getNewUUID');
  // console.log(res);
  // return await res.json();

  const res = await fetch('http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx/panel/api/server/getNewUUID', {
    method: 'GET',
    headers: {
      'Cookie': COOKIE
    }
  });
  
  if (res.ok) {
    return (await res.json())
  }
}
// getUUID();

async function addUser() {
  try {
    const res = await getUUID();
    if (res.success) {
      const uuid = res.obj.uuid;
      
      const subId = crypto.randomBytes(8).toString('hex');
      const email = crypto.randomBytes(4).toString('hex');

      console.log(JSON.stringify({
        id: 1,
        settings: {
          clients: [
            {
              id: uuid,
              flow: "xtls-rprx-vision",
              email,
              limitIp: 0,
              totalGB: 0,
              expiryTime: 0,
              enable: true,
              tgId: "",
              subId,
              comment: "test_user",
              reset: 0
            }
          ]
        }
      }));

      const newUser = await fetch('http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx/panel/api/inbounds/addClient',  {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cookie': COOKIE
        },
       body: JSON.stringify({
        id: 1,
        settings: JSON.stringify({
          clients: [
            {
              id: uuid,
              flow: "xtls-rprx-vision",
              email,
              limitIp: 0,
              totalGB: 0,
              expiryTime: 0,
              enable: true,
              tgId: "",
              subId,
              comment: "test user",
              reset: 0
            }
          ]
        })
      })
      });

      if (newUser.ok) {
        console.log(await newUser.json())
        console.log(`vless://${uuid}@2.58.65.216:443?type=tcp&encryption=none&security=reality&pbk=-k6w2grhneEA0VFavxxRCsnKrAgOisjK8fGBRyEqZg8&fp=chrome&sni=google.com&sid=9adc&spx=%2F&flow=xtls-rprx-vision#admin-${email}`)
      }
    } else {
      throw new Error('Не удалось получить uuid')
    }

  } catch(e) {
    console.error(e);
  }
}

async function deleteUser() {
  try {
    const delUser = await fetch('http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx/panel/api/inbounds/1/delClient/a050d65f-e26d-4536-b6e3-1a530d3e9962',  {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Cookie': COOKIE
      },
    });

    if (delUser.ok) {
      console.log(await delUser.json())
    } else {
      console.log(delUser.status)
    }

  } catch(e) {
    console.error(e);
  }
}

// addUser();
// loginGetCookie();
// deleteUser();

class VPN {
  constructor() {
    this.basePath = "http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx";
    this.username = process.env.VPN_USERNAME;
    this.password = process.env.VPN_PASSWORD;
    this.cookie;
  }

  async login() {
    try {
      const res = await fetch(`${this.basePath}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // "User-Agent": "Mozilla/5.0"
        },
        body: `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`
      });
  
      if (!res.ok) throw new Error("Login failed: " + res.status);
  
      // Получаем Set-Cookie из заголовков
      const rawCookies = res.headers.getSetCookie();
      if (!rawCookies) throw new Error("No cookies returned");
  
      // Объединяем куки в одну строку
      this.cookie = rawCookies.map(c => c.split(";")[0]).join("; ");
    } catch(e) {
      console.log(e);
    }
  }

  async getUUID() {
    console.log(this.cookie);
    try {
      const res = await fetch(this.basePath + '/panel/api/server/getNewUUID', {
        method: 'GET',
        headers: {
          'Cookie': this.cookie
        }
      });
      
      if (res.ok) {
        return (await res.json())
      } else {
        throw new Error('Ошибка получения uuid: ' + res.status)
      }
    } catch (e) {
      console.error(e);
      return {success: false};
    }
  }

  async addUser(userId) {
    try {
      const res = await this.getUUID();
      if (res.success) {
        const uuid = res.obj.uuid;
        
        const subId = crypto.randomBytes(8).toString('hex');
        const email = crypto.randomBytes(4).toString('hex');

        const newUser = await fetch(this.basePath + '/panel/api/inbounds/addClient',  {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Cookie': this.cookie
          },
          body: JSON.stringify({
            id: 1,
            settings: JSON.stringify({
              clients: [
                {
                  id: uuid,
                  flow: "xtls-rprx-vision",
                  email,
                  limitIp: 0,
                  totalGB: 0,
                  expiryTime: 0,
                  enable: true,
                  tgId: "",
                  subId,
                  comment: "user" + userId,
                  reset: 0
                }
              ]
            })
          })
        });

        if (newUser.ok) {
          return {
            success: true,
            url: `vless://${uuid}@2.58.65.216:443?type=tcp&encryption=none&security=reality&pbk=-k6w2grhneEA0VFavxxRCsnKrAgOisjK8fGBRyEqZg8&fp=chrome&sni=google.com&sid=9adc&spx=%2F&flow=xtls-rprx-vision#admin-${email}`,
            uuid,
            email,
            subId,
          }
        } else {
          throw new Error('Не удалось создать пользователя: ' + newUser.status);
        }
      } else {
        throw new Error('Не удалось получить uuid')
      }

    } catch(e) {
      console.error(e);
      return {success: false}
    }
  }

  async deleteUser(uuid) {
    try {
      const delUser = await fetch(this.basePath + '/panel/api/inbounds/1/delClient/' + uuid,  {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Cookie': this.cookie
        },
      });

      if (delUser.ok) {
        return {success: true}
      } else {
        throw new Error('Ошибка удаления пользователя: ' + delUser.status);
      }

    } catch(e) {
      console.error(e);
      return {success: false}
    }
  }

  static initSession() {
    const vpn = new VPN();
    vpn.login();
    setInterval(vpn.login, 1000 * 60 * 60 * 3);

    return vpn;
  }
}

const vpnapi = VPN.initSession();


module.exports = vpnapi;