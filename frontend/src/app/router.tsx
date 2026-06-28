import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { LoginPage } from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { MenusPage } from '../features/menus';
import { RecipeDetailPage, RecipeListPage, RecipeNewPage } from '../features/recipes';
import { ShoppingListPage } from '../features/shoppingList';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: <DashboardPage />,
      },
      {
        path: '/recipes',
        element: <RecipeListPage />,
      },
      {
        path: '/recipes/new',
        element: <RecipeNewPage />,
      },
      {
        path: '/recipes/:id',
        element: <RecipeDetailPage />,
      },
      {
        path: '/menus',
        element: <MenusPage />,
      },
      {
        path: '/shopping-list',
        element: <ShoppingListPage />,
      },
    ],
  },
]);
