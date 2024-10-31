import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export class RequestValidator {
  ghesUrl: string;
  client: jwksClient.JwksClient;

  constructor(serverUrl: string) {
    this.ghesUrl = serverUrl;
    this.client = jwksClient({
      jwksUri: `${this.ghesUrl}/_services/token/.well-known/jwks`
    });
  }

  getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    let client = jwksClient({
      jwksUri: `${this.ghesUrl}/_services/token/.well-known/jwks`
    });
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

  /* 
  * Extract the token from the authorization header and verify it
  * The header should look like this
  * Bearer xyz....123,Bearer xxxxx
  */
  public async veryfyAuthHeader(authHeader: string): Promise<boolean> {
    // The token is the value between the 'Bearer ' prefix and the ',Bearer xxxxx' suffix
      // It looks like Bearer eyJ0e....,Bearer xxxxx
      if(authHeader.slice(0, 7) !== 'Bearer ') {
        console.log('Token does not start with Bearer');
        return false;
      }
    
      if(authHeader.slice(-13) !== ',Bearer xxxxx') {
        console.log('Token does not end with Bearer xxxxx');
        return false;
      }
    
      const token = authHeader.slice(7, -13);
      
      if (!token) {
          console.log('No token found in the authorization header');
          return false;
      }
    
      return this.veryfyToken(token);
  }
  
  /*
  * Verify the JWT token using the public key from the server
  */
  public veryfyToken(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) {
          console.log('Token validation error:', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}






