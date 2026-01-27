import { fireEvent, screen } from "@testing-library/dom"
import NewBillUI from "../views/NewBillUI.js"
import NewBill from "../containers/NewBill.js"
import { ROUTES_PATH } from "../constants/routes.js"

// Helper pour attendre la résolution des Promises (then / catch)
const flushPromises = () => new Promise(setImmediate)

describe("Étant donné que je suis connecté en tant qu’employé", () => {
    beforeEach(() => {
        // GIVEN : Page NewBill affichée
        document.body.innerHTML = NewBillUI()

        // GIVEN : Utilisateur employé présent dans localStorage
        Object.defineProperty(window, "localStorage", {
            value: {
                getItem: jest.fn(() =>
                    JSON.stringify({ type: "Employee", email: "a@a" })
                ),
                setItem: jest.fn(),
                removeItem: jest.fn()
            },
            writable: true
        })

        // GIVEN : les fonctions globales sont mockés
        jest.spyOn(console, "log").mockImplementation(() => {})
        jest.spyOn(console, "error").mockImplementation(() => {})
        window.alert = jest.fn()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe("Gestion de upload fichier", () => {
        test("Quand fichier invalide, alerte affichée et aucun envoi effectué", async () => {
            // GIVEN : Container NewBill avec store mocké
            const onNavigate = jest.fn()
            const store = {
                bills: () => ({
                    create: jest.fn(() =>
                        Promise.resolve({ fileUrl: "x", key: "y" })
                    )
                })
            }

            const newBill = new NewBill({
                document,
                onNavigate,
                store,
                localStorage: window.localStorage
            })

            // GIVEN : Fichier PDF
            const file = new File(["dummy"], "test.pdf", {
                type: "application/pdf"
            })
            const inputFile = screen.getByTestId("file")

            Object.defineProperty(inputFile, "files", {
                value: [file],
                writable: false
            })

            // WHEN : Utilisateur sélectionne fichier
            fireEvent.change(inputFile)

            // THEN : Alerte affichée
            expect(window.alert).toHaveBeenCalled()

            // THEN : Champ fichier vidé
            expect(inputFile.value).toBe("")

            // THEN : Aucun POST effectué
            expect(store.bills().create).not.toHaveBeenCalled()

            // THEN : Aucune donnée fichier stockée
            expect(newBill.fileUrl).toBeNull()
            expect(newBill.fileName).toBeNull()
        })

        test("Quand le fichier est valide, alors le fichier est envoyé à l’API", async () => {
            // GIVEN : Store mocké avec create()
            const onNavigate = jest.fn()
            const createMock = jest.fn(() =>
                Promise.resolve({
                    fileUrl: "https://localhost/file.png",
                    key: "abc123"
                })
            )

            const store = {
                bills: () => ({
                    create: createMock
                })
            }

            const newBill = new NewBill({
                document,
                onNavigate,
                store,
                localStorage: window.localStorage
            })

            // GIVEN : Fichier image valide
            const file = new File(["dummy"], "justificatif.png", {
                type: "image/png"
            })
            const inputFile = screen.getByTestId("file")

            Object.defineProperty(inputFile, "files", {
                value: [file],
                writable: false
            })

            // WHEN : Utilisateur sélectionne fichier
            fireEvent.change(inputFile)
            await flushPromises()

            // THEN : API appelé (POST create)
            expect(createMock).toHaveBeenCalled()

            // THEN : Données fichier stockées
            expect(newBill.billId).toBe("abc123")
            expect(newBill.fileUrl).toBe("https://localhost/file.png")
            expect(newBill.fileName).toBe("justificatif.png")
        })
    })

    describe("Création d’une note de frais — TEST D’INTÉGRATION POST NEW BILL", () => {
        test("Soumission formulaire, alors note de frais envoyé à l’API et redirection", async () => {

            // GIVEN : Store mocké avec create() et update()
            const onNavigate = jest.fn()

            const createMock = jest.fn(() =>
                Promise.resolve({
                    fileUrl: "https://localhost/receipt.jpg",
                    key: "billKey42"
                })
            )

            const updateMock = jest.fn(() => Promise.resolve())

            const store = {
                bills: () => ({
                    create: createMock,
                    update: updateMock
                })
            }

            new NewBill({
                document,
                onNavigate,
                store,
                localStorage: window.localStorage
            })

            // GIVEN : Fichier valide uploadé
            const file = new File(["dummy"], "receipt.jpg", {
                type: "image/jpeg"
            })
            const inputFile = screen.getByTestId("file")

            Object.defineProperty(inputFile, "files", {
                value: [file],
                writable: false
            })

            fireEvent.change(inputFile)
            await flushPromises()

            // GIVEN : Formulaire rempli
            fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } })
            fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Taxi" } })
            fireEvent.change(screen.getByTestId("amount"), { target: { value: "42" } })
            fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2023-12-01" } })
            fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } })
            fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } })
            fireEvent.change(screen.getByTestId("commentary"), { target: { value: "note" } })

            // WHEN : Formulaire soumis
            fireEvent.submit(screen.getByTestId("form-new-bill"))
            await flushPromises()

            // THEN : Note de frais est envoyée à l’API (POST update)
            expect(updateMock).toHaveBeenCalled()

            // THEN : Données envoyées correctes
            const updateArgs = updateMock.mock.calls[0][0]
            const payload = JSON.parse(updateArgs.data)

            expect(updateArgs.selector).toBe("billKey42")
            expect(payload.email).toBe("a@a")
            expect(payload.type).toBe("Transports")
            expect(payload.name).toBe("Taxi")
            expect(payload.amount).toBe(42)
            expect(payload.date).toBe("2023-12-01")
            expect(payload.fileUrl).toBe("https://localhost/receipt.jpg")
            expect(payload.fileName).toBe("receipt.jpg")
            expect(payload.status).toBe("pending")

            // THEN : Utilisateur redirigé vers la page Bills
            expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH["Bills"])
        })

        test("Quand API renvoie erreur 404 lors de l’envoi, alors erreur loggée et pas de redirection", async () => {
            const onNavigate = jest.fn()

            const createMock = jest.fn(() =>
                Promise.resolve({
                    fileUrl: "https://localhost/receipt.jpg",
                    key: "billKey42"
            })
        )

        const updateMock = jest.fn(() => Promise.reject(new Error("Erreur 404")))

        const store = {
            bills: () => ({
                create: createMock,
                update: updateMock
            })
        }

        new NewBill({
            document,
            onNavigate,
            store,
            localStorage: window.localStorage
        })

        // GIVEN : Upload fichier valide
        const file = new File(["dummy"], "receipt.jpg", { type: "image/jpeg" })
        const inputFile = screen.getByTestId("file")
        Object.defineProperty(inputFile, "files", { value: [file], writable: false })
        fireEvent.change(inputFile)
        await flushPromises()

        // GIVEN : Formulaire rempli
        fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } })
        fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Taxi" } })
        fireEvent.change(screen.getByTestId("amount"), { target: { value: "42" } })
        fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2023-12-01" } })
        fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } })
        fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } })
        fireEvent.change(screen.getByTestId("commentary"), { target: { value: "note" } })

        // WHEN
        fireEvent.submit(screen.getByTestId("form-new-bill"))
        await flushPromises()

        // THEN
        expect(updateMock).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalled()
        expect(onNavigate).not.toHaveBeenCalledWith(ROUTES_PATH["Bills"])
    })

    test("Quand l’API renvoie une erreur 500 lors de l’envoi, alors l’erreur est loggée et je ne suis pas redirigé", async () => {
        // GIVEN
        const onNavigate = jest.fn()

        const createMock = jest.fn(() =>
            Promise.resolve({
                fileUrl: "https://localhost/receipt.jpg",
                key: "billKey42"
            })
        )

        const updateMock = jest.fn(() => Promise.reject(new Error("Erreur 500")))

        const store = {
            bills: () => ({
                create: createMock,
                update: updateMock
            })
        }

        new NewBill({
            document,
            onNavigate,
            store,
            localStorage: window.localStorage
        })

        // GIVEN : upload fichier valide
        const file = new File(["dummy"], "receipt.jpg", { type: "image/jpeg" })
        const inputFile = screen.getByTestId("file")
        Object.defineProperty(inputFile, "files", { value: [file], writable: false })
        fireEvent.change(inputFile)
        await flushPromises()

        // GIVEN : formulaire rempli
        fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } })
        fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Taxi" } })
        fireEvent.change(screen.getByTestId("amount"), { target: { value: "42" } })
        fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2023-12-01" } })
        fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } })
        fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } })
        fireEvent.change(screen.getByTestId("commentary"), { target: { value: "note" } })

        // WHEN
        fireEvent.submit(screen.getByTestId("form-new-bill"))
        await flushPromises()

        // THEN
        expect(updateMock).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalled()
        expect(onNavigate).not.toHaveBeenCalledWith(ROUTES_PATH["Bills"])
    })

    })

    describe("Cas particulier : absence de store", () => {

        test("Quand le store est null, alors la navigation vers Bills fonctionne quand même", async () => {
            // GIVEN : Container NewBill sans store
            const onNavigate = jest.fn()

            new NewBill({
                document,
                onNavigate,
                store: null,
                localStorage: window.localStorage
            })

            // GIVEN : Formulaire rempli
            fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } })
            fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Taxi" } })
            fireEvent.change(screen.getByTestId("amount"), { target: { value: "42" } })
            fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2023-12-01" } })
            fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } })
            fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } })
            fireEvent.change(screen.getByTestId("commentary"), { target: { value: "note" } })

            // WHEN : Formulaire soumis
            fireEvent.submit(screen.getByTestId("form-new-bill"))

            // THEN : Navigation vers Bills effectuée
            expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH["Bills"])
        })
    })
})
