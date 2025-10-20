import { extendTheme } from '@chakra-ui/react';

const classyTheme = extendTheme({
  styles: {
    global: {
      'html, body': {
        background: 'linear-gradient(135deg, #222 0%, #444 100%)',
        color: '#fff',
        fontFamily: 'Inter, Avenir, Helvetica Neue, Arial, sans-serif',
        minHeight: '100vh',
      },
      a: {
        color: '#fff',
        textDecoration: 'none',
        _hover: { color: '#bbb' },
      },
      h1: {
        color: '#fff',
        fontWeight: 700,
        fontSize: '2.5rem',
        letterSpacing: '0.5px',
      },
      h2: {
        color: '#fff',
        fontWeight: 600,
        fontSize: '2rem',
      },
      h3: {
        color: '#fff',
        fontWeight: 500,
        fontSize: '1.5rem',
      },
      table: {
        background: '#222',
        color: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
        border: '1px solid #444',
      },
      th: {
        color: '#fff',
        background: '#222',
      },
      td: {
        color: '#fff',
        background: '#222',
      },
      input: {
        background: '#333',
        color: '#fff',
        border: '1px solid #444',
      },
      select: {
        background: '#333',
        color: '#fff',
        border: '1px solid #444',
      },
      button: {
        background: '#fff',
        color: '#222',
        borderRadius: '8px',
        fontWeight: 600,
        _hover: { background: '#bbb', color: '#222' },
      },
    },
  },
  components: {
    Select: {
      baseStyle: {
        field: {
          bg: '#222',
          color: '#e2e8f0',
          borderColor: '#444',
          _placeholder: { color: '#888' },
        },
        icon: {
          color: '#e2e8f0',
        },
        menu: {
          bg: '#222',
          color: '#e2e8f0',
          borderColor: '#444',
        },
        option: {
          bg: '#222',
          color: '#e2e8f0',
          _hover: { bg: '#333', color: '#fff' },
          _selected: { bg: '#444', color: '#fff' },
        },
      },
      variants: {
        outline: {
          field: {
            bg: '#222',
            color: '#e2e8f0',
            borderColor: '#444',
            _hover: { borderColor: '#888' },
            _focus: { borderColor: '#fff' },
          },
          menu: {
            bg: '#222',
            color: '#e2e8f0',
            borderColor: '#444',
          },
          option: {
            bg: '#222',
            color: '#e2e8f0',
            _hover: { bg: '#333', color: '#fff' },
            _selected: { bg: '#444', color: '#fff' },
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
  },
  fonts: {
    heading: 'Inter, Avenir, Helvetica Neue, Arial, sans-serif',
    body: 'Inter, Avenir, Helvetica Neue, Arial, sans-serif',
  },
  colors: {
    black: '#222',
    gray: {
      50: '#f7f7fa',
      100: '#e2e8f0',
      200: '#cbd5e0',
      300: '#a0aec0',
      400: '#718096',
      500: '#444',
      600: '#222',
      700: '#111',
      800: '#000',
      900: '#000',
    },
    white: '#fff',
  },
});

export default classyTheme;
