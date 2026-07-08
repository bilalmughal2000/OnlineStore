// Minimal OpenAPI document. Extend as endpoints stabilise.
export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Clothing Store API',
    version: '0.1.0',
    description: 'E-commerce backend for the Online Clothing Store (Pakistan market).',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health': { get: { summary: 'Health check', responses: { 200: { description: 'OK' } } } },
    '/auth/register': { post: { summary: 'Register a customer', responses: { 201: { description: 'Created' } } } },
    '/auth/login': { post: { summary: 'Login', responses: { 200: { description: 'OK' } } } },
    '/products': { get: { summary: 'List products (filter/sort/paginate)', responses: { 200: { description: 'OK' } } } },
    '/products/{slug}': { get: { summary: 'Product detail', responses: { 200: { description: 'OK' } } } },
    '/cart': { get: { summary: 'Get cart', responses: { 200: { description: 'OK' } } } },
    '/orders/checkout': { post: { summary: 'Place an order', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } } },
    '/content/homepage': { get: { summary: 'Resolved homepage sections', responses: { 200: { description: 'OK' } } } },
    '/admin/dashboard': { get: { summary: 'Admin dashboard KPIs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
  },
} as const;
