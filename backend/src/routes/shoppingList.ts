import { Hono } from 'hono';
import { adapt } from '../shared/adapt';
import { getShoppingList } from '../shoppingList';

/**
 * /shopping-list 配下のルーター。
 * @see docs/docs/features/api-design.md
 */
const shoppingList = new Hono();

shoppingList.get('/', adapt(getShoppingList));

export default shoppingList;
