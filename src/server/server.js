const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
const server = require('http').Server(app);
const apiRouter = express.Router();
const PORT = process.env.PORT || 8080;
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const fs = require('fs')
const {isPlainObject} = require('lodash');

apiRouter.get('/jwt', (req, res) => {
  const payload = {
    iss: process.env.APPLE_DEV_TEAM,
    iat: Date.now() / 1000,
    exp: (Date.now() / 1000) + 1800,
  };

  try {
    res.send(
      jwt.sign(
        payload,
        fs.readFileSync(process.env.MAPKIT_JS_KEY, 'utf8'),
        {
          header: {
            alg: 'ES256',
            typ: 'JWT',
            kid: process.env.MAPKIT_JS_KID,
          },
        }
      )
    );
  } catch (err) {
    console.error(err);
  }
});

apiRouter.get('/search', async (req, res) => {
  const urlSearchParams = {
    q: req.query.q,
  };

  if (req.query.geocode) {
    urlSearchParams.geocode = req.query.geocode;
  }

  if (req.query.result_type) {
    urlSearchParams.result_type = req.query.result_type;
  }

  if (req.query.max_results) {
    urlSearchParams.max_results = +req.query.max_results;
  }

  const params = new URLSearchParams(urlSearchParams);
  const url = `https://api.twitter.com/1.1/search/tweets.json?${params}`;
  const response = await fetch(
    url,
    {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_API_BEARER_TOKEN}`,
      },
    },
  );
  const json = await response.json();
  const statuses = json.statuses || [];
  const locationMappings = {};

  await Promise.all(
    statuses.map(async ({id, user}) => {
      const {location} = user;

      if (!location) return;

      const params = new URLSearchParams({
        address: location,
        key: process.env.GOOGLE_API_KEY,
      });

      console.log({location});

      const result = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`
      );
      const json = await result.json();
      const {results} = json;

      if (!results || !results.length) return;
      const {geometry} = results[0];

      if (isPlainObject(geometry.location)) {
        locationMappings[id] = geometry.location;
      }

      return null
    })
  )

  res.json({statuses, locationMappings});
});

app.use('/api', apiRouter);

server.listen(PORT);
