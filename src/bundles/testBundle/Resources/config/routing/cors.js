module.exports = {

  //CORS
  "test-cors-settings": {
    pattern: "/test/unit/cors/http/{area}",
    defaults: {
      controller: "testBundle:cors:http"
    }
  },
  "test-cors-http": {
    pattern: "/test/firewall/local/cors/http/{area}",
    defaults: {
      controller: "testBundle:cors:http"
    }
  },
  "test-cors-session-http": {
    pattern: "/test/firewall/cors/session/{protocol}",
    defaults: {
      controller: "testBundle:cors:protocolSession"
    }
  }
};
