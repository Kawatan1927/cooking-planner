import { createBrowserRouter } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Placeholder title="Login" />,
  },
  {
    path: '/',
    element: <Placeholder title="Dashboard" />,
  },
  {
    path: '/recipes',
    element: <Placeholder title="レシピ一覧" />,
  },
  {
    path: '/recipes/new',
    element: <Placeholder title="レシピ登録" />,
  },
  {
    path: '/recipes/:id',
    element: <Placeholder title="レシピ詳細" />,
  },
  {
    path: '/menus',
    element: <Placeholder title="献立一覧" />,
  },
  {
    path: '/shopping-list',
    element: <Placeholder title="買い物リスト" />,
  },
]);
