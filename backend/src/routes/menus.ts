import { Hono } from 'hono';
import { adapt } from '../shared/adapt';
import { getMenus, createMenu, updateMenu, deleteMenu } from '../menus';

/**
 * /menus 配下のルーター。
 * @see docs/docs/features/api-design.md
 */
const menus = new Hono();

menus.get('/', adapt(getMenus));
menus.post('/', adapt(createMenu));
menus.put('/:menuId', adapt(updateMenu));
menus.delete('/:menuId', adapt(deleteMenu));

export default menus;
