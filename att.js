const crypto = require('crypto');

const BASE_URL = "http://2.58.65.216:54321/QdV3cAqpJAikqbJ7qx";
const USERNAME = "hD5Lpo8H4g";
const PASSWORD = "vYV2StUErt";
const COOKIE = "3x-ui=MTc2MzgyOTg3M3xEWDhFQVFMX2dBQUJFQUVRQUFCOV80QUFBUVp6ZEhKcGJtY01EQUFLVEU5SFNVNWZWVk5GVWpCbmFYUm9kV0l1WTI5dEwyMW9jMkZ1WVdWcEx6TjRMWFZwTDNZeUwyUmhkR0ZpWVhObEwyMXZaR1ZzTGxWelpYTF9nUU1CQVFSVmMyVnlBZi1DQUFFREFRSkpaQUVFQUFFSVZYTmxjbTVoYldVQkRBQUJDRkJoYzNOM2IzSmtBUXdBQUFCUV80Sk5BUUlCQ21oRU5VeHdiemhJTkdjQlBDUXlZU1F4TUNReGJVSnlTWFZsVTJoeE4zcExOM2xPZWpaaFJtOTFURWhyZFZoUU5FcE5ZazFHVnpBdk9XdzJSMGwyV0RObU1VMWFiRXhOYlFBPXyS9v5-AMUdN6y20JQJwL02g9OqLGa_MJ7C-ZrWaiSY5g=="

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
deleteUser();