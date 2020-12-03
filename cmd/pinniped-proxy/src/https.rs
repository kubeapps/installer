use anyhow::Result;
use hyper::{HeaderMap, header::HeaderValue};
use native_tls::Certificate;
use url::Url;

const DEFAULT_K8S_API_SERVER_URL: &str = "https://kubernetes.local";
const HEADER_K8S_API_SERVER_URL: &str = "PINNIPED_PROXY_API_SERVER_URL";
const HEADER_K8S_API_SERVER_CA_CERT: &str = "PINNIPED_PROXY_API_SERVER_CERT";
const INVALID_SCHEME_ERROR: &'static str = "invalid scheme, https required";

/// validate_url returns a result containing the validated url or an error if it is invalid.
fn validate_url(u: String) -> Result<String> {
    let result = Url::parse(&u);
    match result {
        Ok(url) => match url.scheme() {
            "https" => Ok(u),
            _ => Err(anyhow::anyhow!(INVALID_SCHEME_ERROR)),
        },
        Err(e) => Err(anyhow::anyhow!(e)),
    }
}

/// get_api_server_url returns a string result from the specified header.
///
/// If none is specified we default to the in-cluster K8S API server URL.
pub fn get_api_server_url(request_headers: &HeaderMap<HeaderValue>) -> Result<String> {
    match request_headers.get(HEADER_K8S_API_SERVER_URL) {
        Some(hv) => {
            // Header values can contain invalid chars.
            match hv.to_str() {
                Ok(hv) => validate_url(hv.to_string()),
                Err(e) => Err(anyhow::anyhow!(e)),
            }
        },
        None => Ok(DEFAULT_K8S_API_SERVER_URL.to_string()),
    }
}

/// get_api_server_cert_auth_data returns a byte vector result containing the base64 decoded value.
pub fn get_api_server_cert_auth_data(request_headers: &HeaderMap<HeaderValue>) -> Result<Vec<u8>> {
    match request_headers.get(HEADER_K8S_API_SERVER_CA_CERT) {
        Some(header_value_b64) => match base64::decode(header_value_b64.as_bytes()) {
            Ok(data) => Ok(data),
            Err(e) => Err(anyhow::anyhow!(e)),
        },
        None => Err(anyhow::anyhow!("header {} required but not present", HEADER_K8S_API_SERVER_CA_CERT)),
    }
}

pub fn cert_for_cert_data(cert_data: Vec<u8>) -> Result<Certificate> {
    match Certificate::from_pem(&cert_data) {
        Ok(c) => Ok(c),
        Err(e) => Err(anyhow::anyhow!(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_API_SERVER_URL: &str = "https://172.1.18.4";
    const VALID_CERT_BASE64: &'static str = "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUN5RENDQWJDZ0F3SUJBZ0lCQURBTkJna3Foa2lHOXcwQkFRc0ZBREFWTVJNd0VRWURWUVFERXdwcmRXSmwKY201bGRHVnpNQjRYRFRJd01UQXlOakl6TXpBME5Wb1hEVE13TVRBeU5ESXpNekEwTlZvd0ZURVRNQkVHQTFVRQpBeE1LYTNWaVpYSnVaWFJsY3pDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDQVFvQ2dnRUJBT1ZKCnFuOVBFZUp3UDRQYnI0cFo1ZjZKUmliOFZ5a2tOYjV2K1hzTVZER01aWGZLb293Y29IYjFwRWh5d0pzeDFiME4Kd2YvZ1JURi9maEgzT0drRnNQMlV2a0lHVytzNUlBd0sxMFRXYkN5VzAwT3lzVkdLcnl5bHNWcEhCWXBZRGJBcQpkdnQzc0FkcFJZaGlLZSs2NkVTL3dQNTdLV3g0SVdwZko0UGpyejh2NkJBWlptZ3o5ZzRCSFNMQkhpbTVFbTdYClBJTmpKL1RJTXFzVW1PR1ppUUNHR0ptRnQxZ21jQTd3eHZ0ZXg2ckkxSWdFNkh5NW10UzJ3NDZaMCtlVU1RSzgKSE9UdnI5aGFETnhJenVjbkduaFlCT2Z2U2VVaXNCR0pOUm5QbENydWx4b2NSZGI3N20rQUdzWW52QitNd2prVQpEbXNQTWZBelpSRHEwekhzcGEwQ0F3RUFBYU1qTUNFd0RnWURWUjBQQVFIL0JBUURBZ0trTUE4R0ExVWRFd0VCCi93UUZNQU1CQWY4d0RRWUpLb1pJaHZjTkFRRUxCUUFEZ2dFQkFBWndybXJLa3FVaDJUYld2VHdwSWlOd0o1NzAKaU9lTVl2WWhNakZxTmt6Tk9OUW55c3lPd1laRGJFMDRrV3AxclRLNHVZaUh3NTJUc0cyelJsZ0QzMzNKaEtvUQpIVloyV1hUT3Z5U2RJaWl5bVpKM2N3d0p2T0lhMW5zZnhYY1NJakJnYnNzYXowMndpRCtlazRPdmlRZktjcXJpCnFQbWZabDZDSkk0NU1rd3JwTExFaTZkNVhGbkhDb3d4eklxQjBrUDhwOFlOaGJYWTNYY2JaNElvY2lMemRBamUKQ1l6NXFVSlBlSDJCcHNaM0JXNXRDbjcycGZYazVQUjlYOFRUTHh6aTA4SU9yYjgvRDB4Tnk3emQyMnVjNXM1bwoveXZIeEt6cXBiczVuRXJkT0JFVXNGWnBpUEhaVGc1dExmWlZ4TG00VjNTZzQwRWUyNFd6d09zaDNIOD0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=";



    #[test]
    fn test_valid_url_success() -> Result<()> {
        let valid_url = "https://example.com:8443".to_string();
        match validate_url(valid_url.clone()) {
            Ok(u) => {
                assert_eq!(valid_url, u);
                Ok(())
            },
            Err(e) => anyhow::bail!("got: {:#?}, want: {}", e, valid_url)
        }
    }

    #[test]
    fn test_valid_url_failure() -> Result<()> {
        let bad_url = "https://example space com".to_string();
        match validate_url(bad_url) {
            Ok(u) => anyhow::bail!("got: {}, want: error", u),
            Err(e) => {
                assert!(e.is::<url::ParseError>(), "got: {:#?}, want: {}", e, url::ParseError::InvalidDomainCharacter);
                Ok(())
            }
        }
    }

    #[test]
    fn test_invalid_protocol() -> Result<()>{
        let invalid_proto = "ftp://example.com".to_string();
        match validate_url(invalid_proto) {
            Ok(u) => anyhow::bail!("got: {}, want: error", u),
            Err(e) => {
                assert_eq!(INVALID_SCHEME_ERROR, e.to_string(), "got: {:#?}, want: {}", e, INVALID_SCHEME_ERROR);
                Ok(())
            }
        }
    }

    #[test]
    fn get_api_server_url_success() -> Result<()> {
        let mut headers = HeaderMap::new();
        headers.insert(HEADER_K8S_API_SERVER_URL, HeaderValue::from_static(VALID_API_SERVER_URL));

        assert_eq!(get_api_server_url(&headers)?, VALID_API_SERVER_URL.to_string());
        Ok(())
    }

    #[test]
    fn get_api_server_url_invalid() -> Result<()> {
        let mut headers = HeaderMap::new();
        headers.insert(HEADER_K8S_API_SERVER_URL, HeaderValue::from_static("not a url"));

        let want = url::ParseError::InvalidDomainCharacter;
        match get_api_server_url(&headers) {
            Ok(got) => anyhow::bail!("got: {}, want: {}", got, want),
            Err(got) => {
                assert!(got.is::<url::ParseError>(), "got: {:#?}, want: {}", got, want);
                Ok(())
            },
        }
    }

    #[test]
    fn get_api_server_url_wrong_scheme() -> Result<()> {
        let mut headers = HeaderMap::new();
        headers.insert(HEADER_K8S_API_SERVER_URL, HeaderValue::from_static("http://172.1.2.18"));

        match get_api_server_url(&headers) {
            Ok(got) => anyhow::bail!("got: {}, want: Err({})", got, INVALID_SCHEME_ERROR),
            Err(got) => {
                assert_eq!(got.to_string(), INVALID_SCHEME_ERROR, "got: {:#?}, want: Err({})", got, INVALID_SCHEME_ERROR);
                Ok(())
            },
        }
    }

    #[test]
    fn get_api_server_url_default() -> Result<()> {
        let headers = HeaderMap::new();

        assert_eq!(get_api_server_url(&headers)?, DEFAULT_K8S_API_SERVER_URL.to_string());
        Ok(())
    }

    #[test]
    fn test_api_server_cert_auth_data_valid() -> Result<()> {
        let mut headers = HeaderMap::new();
        headers.insert(HEADER_K8S_API_SERVER_CA_CERT, HeaderValue::from_static(VALID_CERT_BASE64));

        match get_api_server_cert_auth_data(&headers) {
            Ok(data) => {
                assert_eq!(data, base64::decode(VALID_CERT_BASE64.as_bytes())?);
                Ok(())
            },
            Err(e) => anyhow::bail!("got {}, want: valid cert data", e),
        }
    }

    #[test]
    fn get_api_server_cert_auth_data_nonb64() -> Result<()> {
        let mut headers = HeaderMap::new();
        headers.insert(HEADER_K8S_API_SERVER_CA_CERT, HeaderValue::from_static("not base64 data"));

        match get_api_server_cert_auth_data(&headers) {
            Err(e) => {
                assert!(e.is::<base64::DecodeError>(), "got: {:#?}, want: base64::DecodeErro", e);
                Ok(())
            },
            _ => anyhow::bail!("got: valid cert, wanted base64::DecodeError"),
        }
    }

    #[test]
    fn cert_for_cert_data_success() -> Result<()> {
        match cert_for_cert_data(base64::decode(VALID_CERT_BASE64.as_bytes())?) {
            Ok(_) => Ok(()),
            Err(e) => anyhow::bail!("got {}, want: valid cert", e),
        }
    }

    #[test]
    fn cert_for_cert_data_invalid_pem() -> Result<()> {
        match cert_for_cert_data("not valid PEM".as_bytes().to_vec()) {
            Err(e) => {
                assert!(e.is::<native_tls::Error>(), "got: {:#?}, want: native_tls::Error", e);
                Ok(())
            },
            _ => anyhow::bail!("got: valid cert, wanted native_tls::Error"),
        }
    }
}
