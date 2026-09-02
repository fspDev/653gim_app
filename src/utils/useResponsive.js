import { useWindowDimensions } from 'react-native';

// Breakpoints simples para adaptar la misma pantalla a celular y a PC.
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;   // PC / tablet apaisada
  const isMedium = width >= 640; // tablet o ventana chica de PC
  return {
    width,
    isWide,
    isMedium,
    // En pantallas grandes el contenido se centra en vez de estirarse de punta
    // a punta, que es lo que hacía que el panel se viera mal en PC.
    contentStyle: {
      width: '100%',
      maxWidth: isWide ? 1040 : 720,
      alignSelf: 'center',
      paddingHorizontal: isMedium ? 28 : 20,
    },
    columns: isWide ? 2 : 1,
  };
}
