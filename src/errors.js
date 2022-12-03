class ConnectionError extends Error {
    constructor(code = 0, message = "") {
        super();
        this.code = code;
        this.message = message;
    }
}

module.exports = {
    ConnectionError: ConnectionError
}