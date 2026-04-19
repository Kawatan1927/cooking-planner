import { createBrowserRouter } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';
import { CallbackPage, LoginPage } from '../features/auth';
import { RecipeListPage } from '../features/recipes';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/callback',
    element: <CallbackPage />,
  },
  {
    path: '/',
    element: <Placeholder title="Dashboard" />,
  },
  {
    path: '/recipes',
    element: <RecipeListPage />,
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
