import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://octodemo.com/_services/token/.well-known/jwks'
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
        callback(err, undefined);
    } else if (!key) {
        callback(new Error('No key found'), undefined);
    } else {
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    }
  });
}

export async function isValidToken(token: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) {
          console.log('Token validation error:', err);
          resolve(false);
        } else {
          console.log('Token is valid:', decoded);
          resolve(true);
        }
    });
  });
}