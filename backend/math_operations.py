import sympy as sp

# Módulo de operaciones matemáticas para cálculo multivariable.
# Los comentarios están en español explicando la intención de cada función y pasos importantes.

# Define variables simbólicas globales x e y para ser utilizadas en las operaciones
x, y = sp.symbols('x y')


def _parse_expression(expr_str):
    """
    Helper to safely parse a string expression into a SymPy object.

    Returns a SymPy expression or raises an Exception.
    """
    # Convierte la cadena a una expresión simbólica y maneja errores de parseo
    try:
        return sp.sympify(expr_str)
    except Exception as exc:
        raise ValueError(f"Invalid expression: {exc}")


def _to_string(value):
    """
    Helper to convert SymPy objects or Python values into a clean string.
    """
    # Convierte el valor a cadena para cumplir con el requisito de salida como string
    try:
        return str(value)
    except Exception:
        return "Error: unable to stringify result"


def calculate_partials(expression):
    """
    Calculate partial derivatives df/dx and df/dy and return them as a single string.
    """
    # Calcula las derivadas parciales respecto a x e y, devolviendo una representación en texto
    try:
        expr = _parse_expression(expression)
        fx = sp.diff(expr, x)
        fy = sp.diff(expr, y)
        return _to_string(f"df/dx = {fx}, df/dy = {fy}")
    except Exception as exc:
        return _to_string(f"Error: {exc}")


def calculate_gradient(expression):
    """
    Calculate the gradient vector (fx, fy) and return it as a single string.
    """
    # Calcula el gradiente como un par ordenado y lo devuelve en formato string
    try:
        expr = _parse_expression(expression)
        fx = sp.diff(expr, x)
        fy = sp.diff(expr, y)
        return _to_string(f"({fx}, {fy})")
    except Exception as exc:
        return _to_string(f"Error: {exc}")


def evaluate_function(expression, x0, y0):
    """
    Evaluate the function at point (x0, y0) and return the value as a string.
    """
    # Evalúa la función en el punto dado, usando sustitución simbólica y conversión numérica
    try:
        expr = _parse_expression(expression)
        val = expr.subs({x: sp.sympify(x0), y: sp.sympify(y0)})
        # Intenta obtener una evaluación numérica si es posible
        val_num = sp.N(val)
        return _to_string(val_num)
    except Exception as exc:
        return _to_string(f"Error: {exc}")


def calculate_double_integral(expression, x_limits=None, y_limits=None):
    """
    Calcula la integral doble definida o indefinida de f(x,y).

    - Modo definido: cuando x_limits e y_limits son listas/tuplas de 2 elementos.
      Se calcula ∫∫ f(x,y) dy dx sobre los límites dados.
    - Modo indefinido: cuando los límites son None o inválidos; se devuelve la antiderivada iterada.

    Regresa un diccionario listo para serializar a JSON.
    """
    # Comentario: Manejo de integrales dobles, devolviendo salida estructurada
    try:
        expr = _parse_expression(expression)

        is_def_x = isinstance(x_limits, (list, tuple)) and len(x_limits) == 2
        is_def_y = isinstance(y_limits, (list, tuple)) and len(y_limits) == 2

        if is_def_x and is_def_y:
            # Comentario: Integración definida ∫∫ f dy dx (primero en y, luego en x)
            ax, bx = sp.sympify(x_limits[0]), sp.sympify(x_limits[1])
            ay, by = sp.sympify(y_limits[0]), sp.sympify(y_limits[1])

            inner_def = sp.integrate(expr, (y, ay, by))  # ∫_y f(x,y) dy con límites
            outer_def = sp.integrate(inner_def, (x, ax, bx))  # ∫_x [∫_y f dy] dx con límites
            simplified = sp.simplify(outer_def)
            approx = float(sp.N(simplified))

            # Construye pasos didácticos en español
            steps = [
                f"1️⃣ Se identifica la función f(x,y) = {expr}.",
                f"2️⃣ Primero se integra respecto a y entre {ay} y {by}: ∫_{{y={ay}}}^{{{by}}} f(x,y) dy = {inner_def}.",
                f"3️⃣ Luego se integra respecto a x entre {ax} y {bx}: ∫_{{x={ax}}}^{{{bx}}} [∫ f dy] dx = {outer_def}.",
                "4️⃣ Finalmente, se simplifica la expresión y se obtiene una aproximación numérica."
            ]
            explanation = (
                "La integral doble definida calcula el volumen bajo la superficie z = f(x,y) "
                "sobre el rectángulo determinado por los límites de x e y. Primero se integra en y "
                "y luego en x, aplicando los límites para evaluar el resultado."
            )

            return {
                "type": "definite",
                "integral": _to_string(simplified),
                "approx": approx,
                "steps": steps,
                "explanation": explanation,
            }
        else:
            # Comentario: Integración indefinida (antiderivada iterada): primero en y, luego en x
            inner = sp.integrate(expr, y)  # ∫ f dy
            outer = sp.integrate(inner, x)  # ∫(∫ f dy) dx

            # Pasos y explicación para modo indefinido
            steps = [
                f"1️⃣ Se identifica la función f(x,y) = {expr}.",
                f"2️⃣ Se obtiene la antiderivada respecto a y: ∫ f(x,y) dy = {inner}.",
                f"3️⃣ Luego se integra el resultado anterior respecto a x: ∫(∫ f dy) dx = {outer}.",
                "4️⃣ Al no proporcionarse límites, el resultado corresponde a la antiderivada simbólica (integral indefinida)."
            ]
            explanation = (
                "La integral doble indefinida representa una antiderivada iterada de f(x,y): primero en y "
                "y luego en x. No se aplica evaluación en límites, por lo que el resultado es simbólico."
            )

            return {
                "type": "indefinite",
                "inner_integral": _to_string(inner),
                "double_integral": _to_string(outer),
                "steps": steps,
                "explanation": explanation,
            }
    except Exception as exc:
        # Comentario: En caso de error, devuelve estructura con mensaje
        return {"error": _to_string(f"Error: {exc}")}


def lagrange_method(expression, constraint):
    """
    Apply the Lagrange multipliers method for g(x, y) = 0 and return critical points as a string.
    """
    # Aplica el método de multiplicadores de Lagrange para encontrar puntos críticos con una restricción
    try:
        f = _parse_expression(expression)
        g = _parse_expression(constraint)
        lam = sp.symbols('lambda')

        L = f + lam * g
        eq1 = sp.Eq(sp.diff(L, x), 0)
        eq2 = sp.Eq(sp.diff(L, y), 0)
        eq3 = sp.Eq(g, 0)

        solutions = sp.solve((eq1, eq2, eq3), (x, y, lam), dict=True)

        if not solutions:
            return _to_string("No critical points found")

        # Formatea la salida como una lista de puntos críticos
        formatted = []
        for sol in solutions:
            xs = sol.get(x, None)
            ys = sol.get(y, None)
            ls = sol.get(lam, None)
            formatted.append(f"(x={xs}, y={ys}, lambda={ls})")

        return _to_string("[" + ", ".join(formatted) + "]")
    except Exception as exc:
        return _to_string(f"Error: {exc}")


def calculate_unconstrained_optimization(expression):
    """
    Compute unconstrained optimization for f(x,y):
    - Find critical points solving ∇f = 0
    - Compute Hessian at each point
    - Classify points using determinant D = f_xx*f_yy - (f_xy)^2 and f_xx

    Returns a structured dict ready for JSON serialization.
    """
    # Comentario: Optimización sin restricciones usando SymPy, con fallback numérico cuando sea necesario
    try:
        f = _parse_expression(expression)

        # Derivadas de primer y segundo orden
        fx = sp.diff(f, x)
        fy = sp.diff(f, y)
        fxx = sp.diff(fx, x)
        fyy = sp.diff(fy, y)
        fxy = sp.diff(fx, y)

        # Intentar resolver ∇f=0 simbólicamente
        solutions = []
        try:
            sols = sp.solve((sp.Eq(fx, 0), sp.Eq(fy, 0)), (x, y), dict=True)
            for sol in sols:
                xs = sol.get(x, None)
                ys = sol.get(y, None)
                # Filtrar soluciones simbólicas no numéricas; intentar evaluar
                if xs is None or ys is None:
                    continue
                try:
                    xsn = float(sp.N(xs))
                    ysn = float(sp.N(ys))
                    solutions.append((xsn, ysn))
                except Exception:
                    # Mantener solución si es racional/exacta y evaluable después
                    try:
                        xsn = float(sp.N(sp.sympify(xs)))
                        ysn = float(sp.N(sp.sympify(ys)))
                        solutions.append((xsn, ysn))
                    except Exception:
                        continue
        except Exception:
            solutions = []

        # Si no hay soluciones simbólicas, usar búsqueda numérica con nsolve desde semillas
        if not solutions:
            seeds = []
            # Comentario: Generar semillas en una rejilla moderada para buscar raíces del gradiente
            for sx in [-2.0, -1.0, 0.0, 1.0, 2.0]:
                for sy in [-2.0, -1.0, 0.0, 1.0, 2.0]:
                    seeds.append((sx, sy))
            eqs = [fx, fy]
            for (sx, sy) in seeds:
                try:
                    root = sp.nsolve(eqs, (x, y), (sx, sy), tol=1e-12, maxsteps=100)
                    rx = float(root[0])
                    ry = float(root[1])
                    # Evitar duplicados por cercanía
                    if all((abs(rx - px) > 1e-6 or abs(ry - py) > 1e-6) for (px, py) in solutions):
                        solutions.append((rx, ry))
                except Exception:
                    continue

        # Clasificar puntos usando la prueba de la segunda derivada
        results = []
        for (px, py) in solutions:
            try:
                # Evaluar Hessiano y determinante en el punto
                fxxv = float(sp.N(fxx.subs({x: px, y: py})))
                fyyv = float(sp.N(fyy.subs({x: px, y: py})))
                fxyv = float(sp.N(fxy.subs({x: px, y: py})))
                D = fxxv * fyyv - (fxyv ** 2)
                # Evaluar f en el punto
                fv = float(sp.N(f.subs({x: px, y: py})))

                # Clasificación según D y f_xx
                if D > 1e-10 and fxxv > 0:
                    cls = "Mínimo local"
                    color = "green"
                elif D > 1e-10 and fxxv < 0:
                    cls = "Máximo local"
                    color = "blue"
                elif abs(D) <= 1e-10:
                    cls = "Prueba inconclusa"
                    color = "orange"
                else:
                    cls = "Punto de silla"
                    color = "red"

                results.append({
                    "x": px,
                    "y": py,
                    "f": fv,
                    "classification": cls,
                    "color": color,
                    "determinant": D,
                    "fxx": fxxv,
                    "fyy": fyyv,
                    "fxy": fxyv,
                })
            except Exception:
                continue

        # Construir explicación textual
        latex_fx = sp.latex(fx)
        latex_fy = sp.latex(fy)
        explanation = (
            "Se resuelve el sistema ∇f = 0 para encontrar puntos críticos. "
            "Luego se calcula el Hessiano H y el determinante D = f_{xx} f_{yy} - (f_{xy})^2. "
            "Si D > 0 y f_{xx} > 0 hay mínimo local; si D > 0 y f_{xx} < 0 hay máximo local; "
            "si D < 0 es un punto de silla; si D = 0 la prueba es inconclusa."
        )

        return {
            "gradient_latex": rf"\\nabla f = \left( {latex_fx},\; {latex_fy} \right)",
            "critical_points": results,
            "explanation": explanation,
        }
    except Exception as exc:
        return {"error": _to_string(f"Error: {exc}")}