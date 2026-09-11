function notFound(req, res) {
    res.status(404).json({
        error: 'Route not found.'
    });
}

function errorHandler(err, req, res, next) {
    console.error('[API ERROR]', err);

    res.status(500).json({
        error: 'Internal mission-control error.'
    });
}

module.exports = {
    notFound,
    errorHandler
};