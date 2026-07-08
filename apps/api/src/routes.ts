import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { productsRouter } from './modules/catalog/products.routes';
import { categoriesRouter } from './modules/catalog/categories.routes';
import { cartRouter } from './modules/cart/cart.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { accountRouter } from './modules/account/account.routes';
import { contentRouter } from './modules/content/content.routes';
import { adminRouter } from './modules/admin';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/account', accountRouter);
apiRouter.use('/content', contentRouter);
apiRouter.use('/admin', adminRouter);
